import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { compileJourney } from "@/lib/journey/schema";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const journeys = await journeyRepo.findByTenant(tenantId);
  return NextResponse.json({ journeys });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const compiled = compileJourney(body);
    if (!compiled.valid) {
      return NextResponse.json({
        error: "Journey validation failed",
        issues: compiled.errors,
        warnings: compiled.warnings,
      }, { status: 422 });
    }

    const normalized = compiled.normalized;
    const journey = await journeyRepo.create({
      tenant_id: tenantId,
      name: normalized.name || "New Journey",
      description: normalized.description || "",
      status: normalized.status || "draft",
      execution_mode: normalized.execution_mode || "deterministic",
      nodes: normalized.nodes || [],
      edges: normalized.edges || [],
      variables: normalized.variables || {},
      version: normalized.version || "1.0.0",
    });
    return NextResponse.json({ journey, validation: { warnings: compiled.warnings } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create journey" }, { status: 400 });
  }
}
