// Accept escalated conversation handoff.
// POST /api/conversations/[id]/accept-handoff
//
// Called by a human agent to claim an escalated conversation.
// - Assigns the conversation to the authenticated agent
// - Updates status to 'open' (from 'escalated')
// - Records acceptance in dialog_states.handoff_state
// - Dispatches escalation.resolved webhook event

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const agentId = (auth as { user: { userId: string } }).user.userId;

  // Verify conversation belongs to tenant and is escalated
  const convResult = await query(
    `SELECT id, status, assigned_to FROM conversations WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );

  if (convResult.rows.length === 0) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const conv = convResult.rows[0];
  if (conv.status !== "escalated") {
    return NextResponse.json({
      error: `Conversation is not in escalated state (current: ${conv.status})`,
    }, { status: 409 });
  }

  const now = new Date().toISOString();

  // Assign to agent and update status
  await run(
    `UPDATE conversations SET status = 'open', assigned_to = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
    [agentId, now, id, tenantId]
  );

  // Update handoff_state with accepted_at and accepted_by
  await query(
    `UPDATE dialog_states
     SET handoff_state = CASE
       WHEN handoff_state IS NULL THEN $1::jsonb
       ELSE handoff_state || $1::jsonb
     END,
     updated_at = $2
     WHERE conversation_id = $3 AND tenant_id = $4`,
    [
      JSON.stringify({ accepted_by: agentId, accepted_at: now }),
      now,
      id,
      tenantId,
    ]
  ).catch(async () => {
    // SQLite fallback
    await run(
      `UPDATE dialog_states SET handoff_state = $1, updated_at = $2 WHERE conversation_id = $3 AND tenant_id = $4`,
      [JSON.stringify({ accepted_by: agentId, accepted_at: now }), now, id, tenantId]
    ).catch(() => {});
  });

  dispatchWebhookEvent({
    type: "escalation.resolved",
    tenantId,
    payload: {
      conversation_id: id,
      accepted_by: agentId,
      accepted_at: now,
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    conversation_id: id,
    accepted_by: agentId,
    accepted_at: now,
    status: "open",
  });
}
