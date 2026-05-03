import { NextRequest, NextResponse } from "next/server";
import { simulationRunRepo, journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  try {
    const { scenarioId } = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const journey = await journeyRepo.findById(scenarioId);
    if (!journey) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

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
    if (metrics.accuracy < 70) issues.push("Incorrect information provided");

    const run = await simulationRunRepo.create({
      tenant_id: tenantId,
      scenario_name: journey.name,
      outcome,
      metrics,
      issues,
      messages: [
        { role: "user", text: "Hi, I need help with my order." },
        { role: "assistant", text: "I'd be happy to help! Could you provide your order number?" },
      ],
    });

    return NextResponse.json({ run });
  } catch {
    return NextResponse.json({ error: "Simulation failed" }, { status: 400 });
  }
}
