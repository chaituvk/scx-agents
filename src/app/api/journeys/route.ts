import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const journeys = await journeyRepo.findByTenant(tenantId);
  return NextResponse.json({ journeys });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const journey = await journeyRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Journey",
      description: body.description || "",
      status: body.status || "draft",
      execution_mode: body.execution_mode || "deterministic",
      nodes: body.nodes || [],
      edges: body.edges || [],
      variables: body.variables || {},
    });
    return NextResponse.json({ journey }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create journey" }, { status: 400 });
  }
}
