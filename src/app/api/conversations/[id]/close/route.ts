import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);

  const r = await run(
    `UPDATE conversations SET status = 'closed', updated_at = $1 WHERE id = $2 AND tenant_id = $3`,
    [new Date().toISOString(), id, tenantId]
  );
  if (!r.changes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  dispatchWebhookEvent({
    type: "conversation.closed",
    tenantId,
    payload: { conversation_id: id, closed_at: new Date().toISOString() },
  }).catch(() => {});

  return NextResponse.json({ ok: true, conversation_id: id, status: "closed" });
}
