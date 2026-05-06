import { NextRequest, NextResponse } from "next/server";
import { generateJourneyFromText } from "@/lib/journey-generator";
import { journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { compileJourney } from "@/lib/journey/schema";

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const generated = await generateJourneyFromText(description);
    const tenantId = await getTenantFromRequest(req);
    const compiled = compileJourney({
      ...generated,
      status: "draft",
      execution_mode: "deterministic",
    });

    if (!compiled.valid) {
      return NextResponse.json({
        generated,
        saved: false,
        error: "Generated journey failed validation",
        issues: compiled.errors,
        warnings: compiled.warnings,
      }, { status: 422 });
    }

    const normalized = compiled.normalized;

    // Auto-save to database as draft
    const journey = await journeyRepo.create({
      tenant_id: tenantId,
      name: normalized.name,
      description: normalized.description,
      status: "draft",
      execution_mode: normalized.execution_mode,
      nodes: normalized.nodes,
      edges: normalized.edges,
      variables: normalized.variables,
      version: normalized.version,
    });

    return NextResponse.json({
      journey,
      generated: normalized,
      validation: { warnings: compiled.warnings },
      saved: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Generation failed", details: message }, { status: 500 });
  }
}
