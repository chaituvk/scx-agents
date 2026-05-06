import { NextRequest, NextResponse } from "next/server";
import { journeyRepo, journeyScenarioRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { journeyScenarioSchema } from "@/lib/journey/scenario-runner";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const stored = await journeyScenarioRepo.findAll(tenantId);
  if (stored.length > 0) {
    return NextResponse.json({
      scenarios: stored.map((scenario) => ({
        id: scenario.id,
        journeyId: scenario.journey_id,
        name: scenario.name,
        description: scenario.description || "",
        difficulty: scenario.category === "policy" ? "hard" : scenario.category === "technical" ? "medium" : "easy",
        category: scenario.category || "behavior",
        status: scenario.status || "active",
        turns: scenario.turns,
        runtime: scenario.runtime || null,
        expectations: scenario.expectations || null,
        tags: scenario.tags || [],
      })),
    });
  }

  const journeys = await journeyRepo.findAll(tenantId);
  const scenarios = journeys.map((j) => ({
    id: j.id,
    name: j.name,
    description: j.description || "",
    difficulty: j.execution_mode === "hybrid" ? "hard" : j.execution_mode === "llm" ? "medium" : "easy",
    mode: j.execution_mode || "deterministic",
  }));
  return NextResponse.json({ scenarios });
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();
    const parsed = journeyScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: "Scenario validation failed",
        issues: parsed.error.issues,
      }, { status: 422 });
    }

    const journeyId = parsed.data.journey_id;
    if (!journeyId) {
      return NextResponse.json({ error: "journey_id is required" }, { status: 400 });
    }

    const journey = await journeyRepo.findById(journeyId);
    if (!journey || journey.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const scenario = await journeyScenarioRepo.create({
      tenant_id: tenantId,
      journey_id: journeyId,
      name: parsed.data.name,
      description: parsed.data.description || "",
      status: parsed.data.status || "active",
      category: parsed.data.category || "behavior",
      turns: parsed.data.turns,
      runtime: parsed.data.runtime || null,
      expectations: parsed.data.expectations || null,
      tags: parsed.data.tags || [],
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 400 });
  }
}
