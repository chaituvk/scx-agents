import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status");
  const channel = url.searchParams.get("channel");
  const assignedTo = url.searchParams.get("assigned_to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const filters: string[] = ["c.tenant_id = $1"];
  const vals: unknown[] = [tenantId];
  let idx = 2;

  if (q) {
    filters.push(`(c.customer_name ILIKE $${idx} OR c.customer_email ILIKE $${idx} OR EXISTS (
      SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content ILIKE $${idx}
    ))`);
    vals.push(`%${q}%`);
    idx++;
  }
  if (status) { filters.push(`c.status = $${idx++}`); vals.push(status); }
  if (channel) { filters.push(`c.channel = $${idx++}`); vals.push(channel); }
  if (assignedTo) { filters.push(`c.assigned_to = $${idx++}`); vals.push(assignedTo); }

  const where = filters.join(" AND ");
  vals.push(limit, offset);

  const res = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
     FROM conversations c WHERE ${where}
     ORDER BY c.updated_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    vals as string[]
  );

  const countRes = await query(
    `SELECT COUNT(*) as total FROM conversations c WHERE ${where}`,
    vals.slice(0, -2) as string[]
  );

  return NextResponse.json({
    conversations: res.rows,
    total: Number(countRes.rows[0]?.total ?? 0),
    limit,
    offset,
  });
}
