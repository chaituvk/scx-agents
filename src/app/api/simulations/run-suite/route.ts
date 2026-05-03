import { NextRequest, NextResponse } from "next/server";
import { simulationRunRepo, journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const journeys = await journeyRepo.findAll(tenantId);
    const runs = [];

    for (const journey of journeys) {
      const outcomes = ["success", "partial", "failure"];
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const metrics = {
        resolution: Math.floor(60 + Math.random() * 40),
        empathy: Math.floor(60 + Math.random() * 40),
        compliance: Math.floor(60 + Math.random() * 40),
        accuracy: Math.floor(60 + Math.random() * 40),
      };
      const issues: string[] = [];
      if (outcome === "failure") issues.push("Agent failed to resolve customer issue");
      if (outcome === "partial") issues.push("Resolution incomplete - required escalation");
      if (metrics.compliance < 75) issues.push("Guardrail violation detected");

      const run = await simulationRunRepo.create({
        tenant_id: tenantId,
        scenario_name: journey.name,
        outcome,
        metrics,
        issues,
        messages: [],
      });
      runs.push(run);
    }

    return NextResponse.json({ runs, total: runs.length });
  } catch {
    return NextResponse.json({ error: "Suite run failed" }, { status: 400 });
  }
}
