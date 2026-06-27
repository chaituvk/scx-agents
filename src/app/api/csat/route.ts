import { NextRequest, NextResponse } from "next/server";
import { csatRepo } from "@/lib/repositories/csat";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, score, comment } = body;

    if (!conversationId || !score) {
      return NextResponse.json({ error: "conversationId and score are required" }, { status: 400 });
    }
    if (score < 1 || score > 5) {
      return NextResponse.json({ error: "score must be between 1 and 5" }, { status: 400 });
    }

    const tenantId = await getTenantFromRequest(req);
    const rating = await csatRepo.submit({ tenantId, conversationId, score: Number(score), comment });

    // Fire webhook event (non-blocking)
    dispatchWebhookEvent({
      type: "csat.submitted",
      tenantId,
      payload: { conversation_id: conversationId, score, comment: comment ?? null },
    }).catch(() => {});

    return NextResponse.json({ rating }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "30");
  const summary = await csatRepo.summary(tenantId, days);
  return NextResponse.json({ summary });
}
