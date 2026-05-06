import { NextRequest, NextResponse } from "next/server";
import { simulationRunRepo, journeyRepo, journeyScenarioRepo, toJourneyScenario } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { createSmokeScenario, runJourneyScenario } from "@/lib/journey/scenario-runner";
import { loadTenantRuntime } from "@/lib/runtime/tenant-runtime";
import { makeAuditEmitter } from "@/lib/audit";
import { emitAuditFromActions, emitJourneyTransitions, type JourneyHistoryEntry } from "@/lib/audit/from-actions";

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const journeys = await journeyRepo.findAll(tenantId);
    const storedScenarios = await journeyScenarioRepo.findAll(tenantId);
    const runtime = await loadTenantRuntime(tenantId);
    const runs = [];

    const scenariosByJourney = new Map<string, typeof storedScenarios>();
    for (const scenario of storedScenarios.filter((s) => (s.status || "active") === "active")) {
      const existing = scenariosByJourney.get(scenario.journey_id) || [];
      existing.push(scenario);
      scenariosByJourney.set(scenario.journey_id, existing);
    }

    for (const journey of journeys) {
      const scenarios = scenariosByJourney.get(journey.id) || [];
      const scenariosToRun = scenarios.length > 0 ? scenarios.map(toJourneyScenario) : [createSmokeScenario(journey)];

      for (const scenario of scenariosToRun) {
        const result = await runJourneyScenario(journey, scenario, runtime);

        const run = await simulationRunRepo.create({
          tenant_id: tenantId,
          scenario_name: scenario.name,
          outcome: result.outcome,
          metrics: result.metrics,
          issues: result.issues,
          messages: result.messages,
        });
        runs.push(run);

        const audit = makeAuditEmitter(`sim:${run.id}`, tenantId);
        const now = new Date().toISOString();
        const transitions: JourneyHistoryEntry[] = result.visitedNodes.map((nodeId) => ({ nodeId, timestamp: now }));
        await emitJourneyTransitions(audit, journey.id, undefined, transitions);
        await emitAuditFromActions(audit, result.actions, { journeyId: journey.id });
      }
    }

    return NextResponse.json({ runs, total: runs.length });
  } catch {
    return NextResponse.json({ error: "Suite run failed" }, { status: 400 });
  }
}
