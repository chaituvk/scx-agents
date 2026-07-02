import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query, run } from "@/lib/db";
import type { AuditEvent, AuditEventType } from "@/lib/agents/types";

// Append-only audit log. No update/delete by design. Events are hash-chained
// so the integrity of the log can be verified offline.
//
// The DB stores rows in snake_case; the public AuditEvent type uses camelCase
// (conversationId, tenantId). This repo handles the translation in both
// directions, plus JSON (de)serialization of the payload column.

interface AuditEventRow {
  id: string;
  tenant_id: string;
  conversation_id: string;
  ts: string;
  type: string;
  payload: string | Record<string, unknown> | null;
}

function rowToEvent(row: AuditEventRow): AuditEvent {
  let payload: Record<string, unknown> = {};
  if (row.payload !== null && row.payload !== undefined) {
    if (typeof row.payload === "string") {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    } else {
      payload = row.payload as Record<string, unknown>;
    }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    ts: typeof row.ts === "string" ? row.ts : new Date(row.ts as unknown as string).toISOString(),
    type: row.type as AuditEventType,
    payload,
  };
}

function computeHash(data: object): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// In-memory store for the last event hash per tenantId:conversationId key.
// This is ephemeral — on restart, verifyIntegrity() re-reads from the DB.
const lastHashStore = new Map<string, string>();

class AuditEventRepo {
  async insert(
    event: Omit<AuditEvent, "id" | "ts"> & { id?: string; ts?: string }
  ): Promise<AuditEvent> {
    const id = event.id || uuidv4();
    const ts = event.ts || new Date().toISOString();

    const chainKey = `${event.tenantId}:${event.conversationId}`;
    const prevHash = lastHashStore.get(chainKey) ?? null;

    const payload: Record<string, unknown> = {
      ...(event.payload ?? {}),
      ...(prevHash !== null ? { prev_hash: prevHash } : {}),
    };

    // Compute this event's hash over its stable fields + payload (without event_hash itself)
    const hashSource = {
      id,
      tenantId: event.tenantId,
      conversationId: event.conversationId,
      ts,
      type: event.type,
      payload,
    };
    const eventHash = computeHash(hashSource);
    payload.event_hash = eventHash;

    await run(
      `INSERT INTO audit_events (id, tenant_id, conversation_id, ts, type, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, event.tenantId, event.conversationId, ts, event.type, JSON.stringify(payload)]
    );

    lastHashStore.set(chainKey, eventHash);

    return {
      id,
      tenantId: event.tenantId,
      conversationId: event.conversationId,
      ts,
      type: event.type,
      payload,
    };
  }

  async listByConversation(conversationId: string, limit?: number): Promise<AuditEvent[]> {
    const sql = limit
      ? "SELECT * FROM audit_events WHERE conversation_id = $1 ORDER BY ts ASC LIMIT $2"
      : "SELECT * FROM audit_events WHERE conversation_id = $1 ORDER BY ts ASC";
    const params: unknown[] = limit ? [conversationId, limit] : [conversationId];
    const result = await query(sql, params as never[]);
    return (result.rows as AuditEventRow[]).map(rowToEvent);
  }

  async verifyIntegrity(
    conversationId: string
  ): Promise<{ valid: boolean; events: number; firstBroken?: string }> {
    const events = await this.listByConversation(conversationId);

    let prevHash: string | null = null;

    for (const event of events) {
      const storedHash = event.payload?.event_hash as string | undefined;
      const storedPrevHash = event.payload?.prev_hash as string | undefined | null;

      if (!storedHash) {
        // Events without a hash (legacy / pre-chaining) break the chain
        return { valid: false, events: events.length, firstBroken: event.id };
      }

      // Reconstruct the payload as it was before event_hash was added
      const { event_hash: _eventHash, ...payloadWithoutHash } = event.payload as Record<string, unknown>;
      const hashSource = {
        id: event.id,
        tenantId: event.tenantId,
        conversationId: event.conversationId,
        ts: event.ts,
        type: event.type,
        payload: payloadWithoutHash,
      };
      const expectedHash = computeHash(hashSource);

      if (expectedHash !== storedHash) {
        return { valid: false, events: events.length, firstBroken: event.id };
      }

      // Check prev_hash linkage
      const expectedPrevHash = prevHash ?? undefined;
      const actualPrevHash = storedPrevHash ?? undefined;
      if (expectedPrevHash !== actualPrevHash) {
        return { valid: false, events: events.length, firstBroken: event.id };
      }

      prevHash = storedHash;
    }

    return { valid: true, events: events.length };
  }
}

export const auditEventRepo = new AuditEventRepo();
export type { AuditEvent, AuditEventType };
