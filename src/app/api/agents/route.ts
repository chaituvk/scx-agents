import { NextRequest, NextResponse } from "next/server";
import { agentRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const agents = await agentRepo.findAll(tenantId);
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const agent = await agentRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Agent",
      description: body.description || "",
      status: body.status || "draft",
      goals: body.goals || [],
      skills: body.skills || [],
      guardrails: body.guardrails || [],
      languages: body.languages || ["English"],
      channels: body.channels || [],
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create agent" }, { status: 400 });
  }
}
