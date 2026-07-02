import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "audit", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const url = new URL(req.url);
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const eventType = url.searchParams.get("type");
  const since = url.searchParams.get("since");

  const conditions: string[] = ["tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (eventType) {
    conditions.push(`type = $${idx++}`);
    params.push(eventType);
  }
  if (since) {
    conditions.push(`ts >= $${idx++}`);
    params.push(since);
  }

  const where = conditions.join(" AND ");
  const countRes = await query(
    `SELECT COUNT(*) AS total FROM audit_events WHERE ${where}`,
    params as string[]
  ).catch(() => ({ rows: [{ total: 0 }] }));

  params.push(limit);
  params.push(offset);
  const dataRes = await query(
    `SELECT id, conversation_id, ts, type, payload FROM audit_events
     WHERE ${where}
     ORDER BY ts DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params as string[]
  ).catch(() => ({ rows: [] }));

  const events = dataRes.rows.map((r) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = typeof r.payload === "string" ? JSON.parse(r.payload) : (r.payload as Record<string, unknown>) ?? {};
    } catch { /* ignore */ }
    // Strip internal chain hashes from API response
    const { event_hash: _eh, prev_hash: _ph, ...safePayload } = payload;
    return {
      id: r.id,
      conversation_id: r.conversation_id,
      ts: r.ts,
      type: r.type,
      payload: safePayload,
    };
  });

  return NextResponse.json({
    total: Number(countRes.rows[0]?.total ?? 0),
    limit,
    offset,
    events,
  });
}
