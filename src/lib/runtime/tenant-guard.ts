import type { Conversation, DialogState, Journey } from "@/lib/repositories";

export interface TenantAccessCheck {
  tenantId: string;
  conversation?: Conversation | null;
  dialogState?: DialogState | null;
  journey?: Journey | null;
}

export interface TenantAccessResult {
  ok: boolean;
  status: number;
  error?: string;
}

function belongsToTenant(entity: { tenant_id?: string } | null | undefined, tenantId: string): boolean {
  return !entity || entity.tenant_id === tenantId;
}

export function assertTenantAccess({
  tenantId,
  conversation,
  dialogState,
  journey,
}: TenantAccessCheck): TenantAccessResult {
  if (conversation && !belongsToTenant(conversation, tenantId)) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }

  if (dialogState && !belongsToTenant(dialogState, tenantId)) {
    return { ok: false, status: 404, error: "Conversation state not found" };
  }

  if (journey && !belongsToTenant(journey, tenantId)) {
    return { ok: false, status: 404, error: "Journey not found" };
  }

  if (dialogState?.conversation_id && conversation?.id && dialogState.conversation_id !== conversation.id) {
    return { ok: false, status: 409, error: "Conversation state mismatch" };
  }

  if (dialogState?.journey_id && journey?.id && dialogState.journey_id !== journey.id) {
    return { ok: false, status: 409, error: "Journey state mismatch" };
  }

  return { ok: true, status: 200 };
}

