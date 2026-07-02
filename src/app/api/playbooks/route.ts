import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const playbooks = await playbookRepo.findAll(tenantId);
    return NextResponse.json({ playbooks });
  } catch {
    return NextResponse.json({ error: "Failed to fetch playbooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const playbook = await playbookRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Playbook",
      description: body.description ?? "",
      status: body.status ?? "draft",
      persona: body.persona ?? "",
      topics: body.topics ?? [],
      instructions: body.instructions ?? [],
      policies: body.policies ?? [],
      actions: body.actions ?? [],
      escalation_triggers: body.escalation_triggers ?? [],
      end_message: body.end_message ?? null,
      model_tier: body.model_tier ?? "reasoning",
    });
    return NextResponse.json({ playbook }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create playbook" }, { status: 400 });
  }
}
