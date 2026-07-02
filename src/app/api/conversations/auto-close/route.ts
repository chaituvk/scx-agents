// Auto-close stale open conversations.
// POST /api/conversations/auto-close
// Body: { inactivity_minutes?: number }  (default: 30)
// Returns: { closed: number, conversation_ids: string[] }
//
// Typically called by a cron job or scheduled task.
// Requires auth and the caller must have admin or write access.

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  let inactivityMinutes = 30;

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.inactivity_minutes === "number" && body.inactivity_minutes > 0) {
      inactivityMinutes = Math.min(body.inactivity_minutes, 10080); // max 1 week
    }
  } catch { /* use default */ }

  const cutoff = new Date(Date.now() - inactivityMinutes * 60 * 1000).toISOString();

  // Find open conversations with no messages after the cutoff
  const stale = await query(
    `SELECT DISTINCT c.id FROM conversations c
     WHERE c.tenant_id = $1 AND c.status = 'open'
     AND c.updated_at < $2
     AND NOT EXISTS (
       SELECT 1 FROM messages m
       WHERE m.conversation_id = c.id AND m.created_at >= $3
     )`,
    [tenantId, cutoff, cutoff]
  ).catch(async () => {
    // SQLite fallback (no ANY syntax)
    return query(
      `SELECT DISTINCT c.id FROM conversations c
       WHERE c.tenant_id = $1 AND c.status = 'open'
       AND c.updated_at < $2
       AND NOT EXISTS (
         SELECT 1 FROM messages m
         WHERE m.conversation_id = c.id AND m.created_at >= $3
       )`,
      [tenantId, cutoff, cutoff]
    );
  });

  const ids = stale.rows.map((r) => r.id as string);

  if (ids.length === 0) {
    return NextResponse.json({ closed: 0, conversation_ids: [] });
  }

  const now = new Date().toISOString();

  // Close them all
  for (const id of ids) {
    await run(
      `UPDATE conversations SET status = 'closed', updated_at = $1 WHERE id = $2 AND tenant_id = $3`,
      [now, id, tenantId]
    ).catch(() => {});

    dispatchWebhookEvent({
      type: "conversation.closed",
      tenantId,
      payload: { conversation_id: id, closed_at: now, reason: "auto_close_inactivity" },
    }).catch(() => {});
  }

  return NextResponse.json({ closed: ids.length, conversation_ids: ids });
}
