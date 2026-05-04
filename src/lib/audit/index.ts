import { auditEventRepo } from "@/lib/repositories/audit-event";
import type {
  AuditEvent,
  AuditEventType,
  AuditEmitter,
} from "@/lib/agents/types";

// Append-only audit log used by the orchestrator. Writes are awaited so
// failures surface to the caller — lossy audit is worse than slow audit.

export class AuditStore {
  async emit(event: Omit<AuditEvent, "id" | "ts">): Promise<AuditEvent> {
    return auditEventRepo.insert(event);
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
