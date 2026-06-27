// Clone a playbook — creates a new draft copy with "(Copy)" appended to name.
// POST /api/playbooks/[id]/clone
// Returns: { playbook } (the new clone)

import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);

  const original = await playbookRepo.findById(id);
  if (!original || original.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  const clone = await playbookRepo.create({
    tenant_id: tenantId,
    name: `${original.name} (Copy)`,
    description: original.description ?? "",
    status: "draft",
    persona: original.persona ?? "",
    topics: original.topics ?? [],
    instructions: original.instructions ?? [],
    policies: original.policies ?? [],
    actions: original.actions ?? [],
    escalation_triggers: original.escalation_triggers ?? [],
    end_message: original.end_message,
    model_tier: original.model_tier,
  });

  return NextResponse.json({ playbook: clone }, { status: 201 });
}
