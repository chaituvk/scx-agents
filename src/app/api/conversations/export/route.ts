// GET /api/conversations/export?format=csv|json&status=open|resolved|escalated&from=ISO&to=ISO
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") ?? "csv";
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const conditions: string[] = ["c.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let i = 2;

  if (status) { conditions.push(`c.status = $${i++}`); params.push(status); }
  if (channel) { conditions.push(`c.channel = $${i++}`); params.push(channel); }
  if (fromDate) { conditions.push(`c.created_at >= $${i++}`); params.push(fromDate); }
  if (toDate) { conditions.push(`c.created_at <= $${i++}`); params.push(toDate); }

  const where = conditions.join(" AND ");
  const result = await query(
    `SELECT c.id, c.customer_name, c.customer_email, c.channel, c.status, c.sentiment,
            c.topic, c.priority, c.assigned_to, c.created_at, c.updated_at,
            COUNT(m.id) AS message_count
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id AND m.tenant_id = c.tenant_id
     WHERE ${where}
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT 5000`,
    params,
  );

  const rows = result.rows;

  if (format === "json") {
    return NextResponse.json({ conversations: rows, count: rows.length });
  }

  const header = [
    "id", "customer_name", "customer_email", "channel", "status",
    "sentiment", "topic", "priority", "assigned_to", "message_count",
    "created_at", "updated_at",
  ];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const csvLines = [
    header.join(","),
    ...rows.map((r: Record<string, unknown>) =>
      [
        r.id, r.customer_name, r.customer_email, r.channel, r.status,
        r.sentiment, r.topic, r.priority, r.assigned_to, r.message_count,
        r.created_at, r.updated_at,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  const filename = `conversations-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
