import { NextRequest, NextResponse } from "next/server";
import { knowledgeGapRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const gaps = await knowledgeGapRepo.findAll(tenantId);
  return NextResponse.json({ gaps });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const gap = await knowledgeGapRepo.create({
      tenant_id: tenantId,
      question: body.question || "Unknown question",
      frequency: body.frequency ?? 1,
      status: body.status || "open",
      suggested_answer: body.suggestedAnswer || null,
      source_ids: body.sourceIds || null,
    });
    return NextResponse.json({ gap }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create gap" }, { status: 400 });
  }
}
