import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
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
