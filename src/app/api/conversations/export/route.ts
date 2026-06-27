// Export conversations + messages as JSON or CSV.
// GET /api/conversations/export?format=json|csv&status=open|closed&limit=1000
// Returns a downloadable file.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.map((k) => `"${k}"`).join(",");
  const lines = rows.map((r) =>
    keys.map((k) => {
      const v = r[k];
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);

  const format = searchParams.get("format") === "csv" ? "csv" : "json";
  const status = searchParams.get("status") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "1000"), 5000);
  const includeMessages = searchParams.get("messages") === "true";

  const conditions: string[] = ["c.tenant_id = $1"];
  const params: unknown[] = [tenantId];

  if (status && ["open", "closed", "escalated"].includes(status)) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  const where = conditions.join(" AND ");
  params.push(limit);

  const convResult = await query(
    `SELECT c.id, c.customer_name, c.customer_email, c.channel, c.status,
            c.sentiment, c.assigned_to, c.topic, c.priority, c.created_at, c.updated_at
     FROM conversations c
     WHERE ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  const conversations = convResult.rows;

  if (includeMessages && conversations.length > 0) {
    const convIds = conversations.map((c) => c.id as string);
    // Fetch messages for all conversations
    const msgResult = await query(
      `SELECT conversation_id, role, content, agent_id, intent, created_at
       FROM messages
       WHERE tenant_id = $1 AND conversation_id IN (${convIds.map((_, i) => `$${i + 2}`).join(",")})
       ORDER BY created_at ASC`,
      [tenantId, ...convIds]
    );

    const messagesByConv: Record<string, unknown[]> = {};
    for (const msg of msgResult.rows) {
      const cid = msg.conversation_id as string;
      if (!messagesByConv[cid]) messagesByConv[cid] = [];
      messagesByConv[cid].push(msg);
    }

    for (const conv of conversations) {
      (conv as Record<string, unknown>).messages = messagesByConv[conv.id as string] ?? [];
    }
  }

  const now = new Date().toISOString().slice(0, 10);
  const filename = `conversations-export-${now}.${format}`;

  if (format === "csv") {
    // Flatten for CSV (no nested messages)
    const csv = toCSV(conversations.map((c) => {
      const { messages: _m, ...rest } = c as Record<string, unknown>;
      return rest;
    }));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new NextResponse(JSON.stringify({ conversations, exported_at: new Date().toISOString(), count: conversations.length }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
