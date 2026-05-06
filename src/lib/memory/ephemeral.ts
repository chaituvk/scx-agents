// L1 ephemeral memory — per-conversation scratch space for inter-skill state.
//
// Backed by dialog_states.context.ephemeral (a sub-key under the existing
// `context` JSONB column). Sibling keys (lastMessage, auditTraceId, etc.)
// are preserved across writes. Importantly, this is NOT the same column as
// `variables` — that remains workflow/journey slot storage. Folding ephemeral
// into context lets the L1 cache live in the same row without colliding with
// slot extraction.
//
// All writes go through dialogStateRepo.writeContextEphemeral, which executes
// the JSON merge in a single SQL statement (PG `jsonb ||` or SQLite
// `json_patch`) — no read-then-write race after the row exists. The
// create-on-first-write path has a small TOCTOU window for brand-new
// conversations; this is acceptable because two concurrent first-turn writes
// on the same conversation are exceedingly rare in practice.
//
// All methods require tenantId. EphemeralStore must NOT be queried by
// conversationId alone — Stage 2 closes that footgun.

import { dialogStateRepo } from "@/lib/repositories/dialog-state";

function readEphemeral(context: unknown): Record<string, unknown> {
  if (!context || typeof context !== "object") return {};
  const ctx = context as { ephemeral?: unknown };
  if (!ctx.ephemeral || typeof ctx.ephemeral !== "object") return {};
  return ctx.ephemeral as Record<string, unknown>;
}

export class EphemeralStore {
  async get(tenantId: string, conversationId: string): Promise<Record<string, unknown>> {
    const state = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
    return readEphemeral(state?.context);
  }

  async set(tenantId: string, conversationId: string, value: Record<string, unknown>): Promise<void> {
    await dialogStateRepo.writeContextEphemeral(tenantId, conversationId, value, "set");
  }

  async merge(tenantId: string, conversationId: string, patch: Record<string, unknown>): Promise<void> {
    await dialogStateRepo.writeContextEphemeral(tenantId, conversationId, patch, "merge");
  }

  async clear(tenantId: string, conversationId: string): Promise<void> {
    await dialogStateRepo.writeContextEphemeral(tenantId, conversationId, {}, "set");
  }
}

export const ephemeralStore = new EphemeralStore();
