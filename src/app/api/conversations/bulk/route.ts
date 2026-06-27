// Bulk operations on conversations.
// POST /api/conversations/bulk
// Body: {
//   action: "close" | "assign" | "set_priority" | "set_status",
//   conversation_ids: string[],
//   params?: { assigned_to?: string; priority?: string; status?: string }
// }

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { dispatchWebhookEvent } from "@/lib/webhooks/delivery";

export const runtime = "nodejs";

const ALLOWED_STATUSES = ["open", "closed", "escalated"] as const;
const ALLOWED_PRIORITIES = ["normal", "high", "urgent"] as const;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: {
    action?: string;
    conversation_ids?: string[];
    params?: Record<string, string>;
  } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, conversation_ids: ids, params = {} } = body;

  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "conversation_ids must be a non-empty array" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Maximum 500 conversations per bulk operation" }, { status: 400 });
  }

  // Verify all conversations belong to the tenant
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
  const existing = await query(
    `SELECT id FROM conversations WHERE tenant_id = $1 AND id IN (${placeholders})`,
    [tenantId, ...ids]
  );
  const validIds = existing.rows.map((r) => r.id as string);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No matching conversations found", updated: 0 }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updated = 0;

  const validPlaceholders = validIds.map((_, i) => `$${i + 2}`).join(",");

  switch (action) {
    case "close": {
      const r = await run(
        `UPDATE conversations SET status = 'closed', updated_at = $1 WHERE tenant_id = $1 AND id IN (${validPlaceholders})`,
        [now, tenantId, ...validIds]
      ).catch(() => ({ changes: 0 }));
      updated = r.changes ?? validIds.length;
      for (const id of validIds) {
        dispatchWebhookEvent({
          type: "conversation.closed",
          tenantId,
          payload: { conversation_id: id, closed_at: now, bulk: true },
        }).catch(() => {});
      }
      break;
    }

    case "assign": {
      const assignedTo = params.assigned_to;
      if (!assignedTo) return NextResponse.json({ error: "params.assigned_to is required for assign action" }, { status: 400 });
      const r = await run(
        `UPDATE conversations SET assigned_to = $1, updated_at = $2 WHERE tenant_id = $3 AND id IN (${validPlaceholders.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`)})`,
        [assignedTo, now, tenantId, ...validIds]
      ).catch(() => ({ changes: 0 }));
      updated = r.changes ?? validIds.length;
      for (const id of validIds) {
        dispatchWebhookEvent({
          type: "conversation.assigned",
          tenantId,
          payload: { conversation_id: id, assigned_to: assignedTo, bulk: true },
        }).catch(() => {});
      }
      break;
    }

    case "set_priority": {
      const priority = params.priority;
      if (!priority || !ALLOWED_PRIORITIES.includes(priority as typeof ALLOWED_PRIORITIES[number])) {
        return NextResponse.json({ error: `params.priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` }, { status: 400 });
      }
      await run(
        `UPDATE conversations SET priority = $1, updated_at = $2 WHERE tenant_id = $3 AND id IN (${validPlaceholders.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`)})`,
        [priority, now, tenantId, ...validIds]
      ).catch(() => {});
      updated = validIds.length;
      break;
    }

    case "set_status": {
      const status = params.status;
      if (!status || !ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
        return NextResponse.json({ error: `params.status must be one of: ${ALLOWED_STATUSES.join(", ")}` }, { status: 400 });
      }
      await run(
        `UPDATE conversations SET status = $1, updated_at = $2 WHERE tenant_id = $3 AND id IN (${validPlaceholders.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`)})`,
        [status, now, tenantId, ...validIds]
      ).catch(() => {});
      updated = validIds.length;
      if (status === "closed") {
        for (const id of validIds) {
          dispatchWebhookEvent({
            type: "conversation.closed",
            tenantId,
            payload: { conversation_id: id, closed_at: now, bulk: true },
          }).catch(() => {});
        }
      }
      break;
    }

    default:
      return NextResponse.json({
        error: `Unknown action: ${action}. Must be one of: close, assign, set_priority, set_status`,
      }, { status: 400 });
  }

  return NextResponse.json({
    action,
    requested: ids.length,
    valid: validIds.length,
    updated,
    processed_at: now,
  });
}
