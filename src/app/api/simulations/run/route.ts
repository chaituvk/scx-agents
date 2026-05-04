import { NextRequest, NextResponse } from "next/server";
import { simulationRunRepo, journeyRepo, journeyScenarioRepo, toJourneyScenario } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { createSmokeScenario, runJourneyScenario } from "@/lib/journey/scenario-runner";
import { loadTenantRuntime } from "@/lib/runtime/tenant-runtime";

export async function POST(req: NextRequest) {
  try {
    const { scenarioId } = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const storedScenario = await journeyScenarioRepo.findById(scenarioId);
    const journey = storedScenario
      ? await journeyRepo.findByIdForTenant(storedScenario.journey_id, tenantId)
      : await journeyRepo.findByIdForTenant(scenarioId, tenantId);

    if (!journey) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    if (journey.tenant_id !== tenantId || (storedScenario?.tenant_id && storedScenario.tenant_id !== tenantId)) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const scenario = storedScenario ? toJourneyScenario(storedScenario) : createSmokeScenario(journey);
    const runtime = await loadTenantRuntime(tenantId);
    const result = await runJourneyScenario(journey, scenario, runtime);

    const run = await simulationRunRepo.create({
      tenant_id: tenantId,
      scenario_name: scenario.name,
      outcome: result.outcome,
      metrics: result.metrics,
      issues: result.issues,
      messages: result.messages,
    });

    return NextResponse.json({ run });
  } catch {
    return NextResponse.json({ error: "Simulation failed" }, { status: 400 });
  }
}
