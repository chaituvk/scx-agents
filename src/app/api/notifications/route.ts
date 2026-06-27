// Virtual notification feed derived from live conversation state.
// Returns unassigned escalations, high-priority open conversations,
// and recently updated conversations as notification items.
// GET /api/notifications?limit=20

import { NextRequest, NextResponse } from "next/server";
import { query, isPostgres } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);

    const nullsLast = isPostgres() ? "NULLS LAST" : "";

    // Escalated and unassigned = top priority notifications
    const escalatedRes = await query(
      `SELECT id, customer_name, customer_email, channel, status, priority, assigned_to, updated_at
       FROM conversations
       WHERE tenant_id = $1 AND status = 'escalated'
       ORDER BY updated_at DESC ${nullsLast}
       LIMIT 10`,
      [tenantId],
    );

    // High/urgent open without agent
    const urgentRes = await query(
      `SELECT id, customer_name, customer_email, channel, status, priority, assigned_to, updated_at
       FROM conversations
       WHERE tenant_id = $1 AND status = 'open'
         AND priority IN ('high', 'urgent')
         AND (assigned_to IS NULL OR assigned_to = '')
       ORDER BY updated_at DESC ${nullsLast}
       LIMIT 10`,
      [tenantId],
    );

    type NotifType = "escalation" | "unassigned_urgent" | "new_conversation";

    interface Notif {
      id: string;
      type: NotifType;
      title: string;
      body: string;
      href: string;
      created_at: string;
    }

    const notifications: Notif[] = [];

    for (const row of escalatedRes.rows) {
      notifications.push({
        id: `esc-${row.id as string}`,
        type: "escalation",
        title: "Escalation requires attention",
        body: `${(row.customer_name as string) || "Anonymous"} · ${row.channel as string}`,
        href: `/inbox`,
        created_at: row.updated_at as string,
      });
    }

    for (const row of urgentRes.rows) {
      notifications.push({
        id: `urg-${row.id as string}`,
        type: "unassigned_urgent",
        title: `${(row.priority as string).charAt(0).toUpperCase() + (row.priority as string).slice(1)} priority — unassigned`,
        body: `${(row.customer_name as string) || "Anonymous"} · ${row.channel as string}`,
        href: `/inbox`,
        created_at: row.updated_at as string,
      });
    }

    // Sort by recency and cap
    notifications.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

    return NextResponse.json({
      notifications: notifications.slice(0, limit),
      unread_count: notifications.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
