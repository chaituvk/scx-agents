import { NextRequest, NextResponse } from "next/server";
import { simulationRunRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const runs = await simulationRunRepo.findAll(tenantId);
  return NextResponse.json({ runs });
}
