import { NextRequest, NextResponse } from "next/server";
import { knowledgeSourceRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const sources = await knowledgeSourceRepo.findAll(tenantId);
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const source = await knowledgeSourceRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Source",
      type: body.type || "help-center",
      status: body.status || "draft",
      entries: body.entries ?? 0,
      url: body.url || null,
      last_sync: body.lastSync || null,
      gaps: body.gaps || null,
      config: body.config || null,
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create source" }, { status: 400 });
  }
}
