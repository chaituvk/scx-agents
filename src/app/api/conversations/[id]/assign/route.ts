import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const body = await req.json();
  const { agentId, userId } = body;

  const assignee = agentId ?? userId;
  if (!assignee) return NextResponse.json({ error: "agentId or userId required" }, { status: 400 });

  const r = await run(
    `UPDATE conversations SET assigned_to = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
    [assignee, new Date().toISOString(), id, tenantId]
  );
  if (!r.changes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  dispatchWebhookEvent({
    type: "conversation.assigned",
    tenantId,
    payload: { conversation_id: id, assigned_to: assignee },
  }).catch(() => {});

  return NextResponse.json({ ok: true, conversation_id: id, assigned_to: assignee });
}
