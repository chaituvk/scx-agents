import { auditEventRepo } from "@/lib/repositories/audit-event";
import type {
  AuditEvent,
  AuditEventType,
  AuditEmitter,
} from "@/lib/agents/types";

// Append-only audit log used by the orchestrator. Writes are awaited so
// failures surface to the caller — lossy audit is worse than slow audit.

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry interfaces and buffer
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryForwarder {
  forward(event: AuditEvent): Promise<void>;
}

const TELEMETRY_BUFFER_MAX = 100;
const TELEMETRY_FLUSH_INTERVAL_MS = 5_000;

class TelemetryBuffer {
  private buffer: AuditEvent[] = [];
  private forwarders: TelemetryForwarder[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  registerForwarder(forwarder: TelemetryForwarder): void {
    this.forwarders.push(forwarder);
  }

  push(event: AuditEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= TELEMETRY_BUFFER_MAX) {
      this.scheduleFlush(true);
    } else if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => this.scheduleFlush(true), TELEMETRY_FLUSH_INTERVAL_MS);
    }
  }

  private scheduleFlush(immediate: boolean): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (immediate) {
      // Fire-and-forget
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.forwarders.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);

    for (const event of batch) {
      for (const forwarder of this.forwarders) {
        try {
          await forwarder.forward(event);
        } catch (err) {
          console.error("[TelemetryBuffer] Forwarding error:", err);
        }
      }
    }
  }
}

export const telemetryBuffer = new TelemetryBuffer();

// Built-in console forwarder — only activates when TELEMETRY_DEBUG=true
class ConsoleForwarder implements TelemetryForwarder {
  async forward(event: AuditEvent): Promise<void> {
    if (process.env.TELEMETRY_DEBUG !== "true") return;
    console.log("[TELEMETRY]", JSON.stringify(event));
  }
}

telemetryBuffer.registerForwarder(new ConsoleForwarder());

// ─────────────────────────────────────────────────────────────────────────────
// AuditStore
// ─────────────────────────────────────────────────────────────────────────────

export class AuditStore {
  private forwarders: TelemetryForwarder[] = [];

  registerForwarder(forwarder: TelemetryForwarder): void {
    this.forwarders.push(forwarder);
    telemetryBuffer.registerForwarder(forwarder);
  }

  async emit(event: Omit<AuditEvent, "id" | "ts">): Promise<AuditEvent> {
    const saved = await auditEventRepo.insert(event);
    // Non-blocking fire-and-forget push to telemetry buffer
    telemetryBuffer.push(saved);
    return saved;
  }

  async listByConversation(conversationId: string, limit?: number): Promise<AuditEvent[]> {
    return auditEventRepo.listByConversation(conversationId, limit);
  }
}

export const auditStore = new AuditStore();

export function makeAuditEmitter(conversationId: string, tenantId: string): AuditEmitter {
  return {
    async emit(type: AuditEventType, payload: Record<string, unknown>): Promise<void> {
      await auditStore.emit({ conversationId, tenantId, type, payload });
    },
  };
}
