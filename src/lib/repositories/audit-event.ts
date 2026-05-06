import { v4 as uuidv4 } from "uuid";
import { query, run } from "@/lib/db";
import type { AuditEvent, AuditEventType } from "@/lib/agents/types";

// Append-only audit log. No update/delete by design.
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

class AuditEventRepo {
  async insert(
    event: Omit<AuditEvent, "id" | "ts"> & { id?: string; ts?: string }
  ): Promise<AuditEvent> {
    const id = event.id || uuidv4();
    const ts = event.ts || new Date().toISOString();
    const payload = event.payload ?? {};

    await run(
      `INSERT INTO audit_events (id, tenant_id, conversation_id, ts, type, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, event.tenantId, event.conversationId, ts, event.type, JSON.stringify(payload)]
    );

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
}

export const auditEventRepo = new AuditEventRepo();
export type { AuditEvent, AuditEventType };
