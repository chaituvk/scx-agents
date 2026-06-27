import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";
import { slaRepo } from "@/lib/repositories/sla";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const now = new Date().toISOString();

  const r = await run(
    `UPDATE conversations SET status = 'closed', updated_at = $1 WHERE id = $2 AND tenant_id = $3`,
    [now, id, tenantId]
  );
  if (!r.changes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SLA resolution check (non-blocking)
  slaRepo.checkBreaches(tenantId).catch(() => {});

  dispatchWebhookEvent({
    type: "conversation.closed",
    tenantId,
    payload: { conversation_id: id, closed_at: now },
  }).catch(() => {});

  // Trigger CSAT survey via webhook so subscribers can deliver it
  dispatchWebhookEvent({
    type: "csat.requested",
    tenantId,
    payload: { conversation_id: id, closed_at: now, survey_url: `/csat?conversation_id=${id}` },
  }).catch(() => {});

  return NextResponse.json({ ok: true, conversation_id: id, status: "closed" });
}
