// Unified global search across conversations, customers, and knowledge base.
// GET /api/search?q=query&limit=10
// Returns results grouped by type.

import { NextRequest, NextResponse } from "next/server";
import { query, isPostgres } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { retrieveKnowledge } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "8"), 20);

    if (!q.trim()) {
      return NextResponse.json({ conversations: [], customers: [], knowledge: [] });
    }

    const like = `%${q}%`;
    const ilikeOp = isPostgres() ? "ILIKE" : "LIKE";

    const [convRes, custRes, kbResults] = await Promise.all([
      query(
        `SELECT id, customer_name, customer_email, channel, status, priority, updated_at
         FROM conversations
         WHERE tenant_id = $1
           AND (customer_name ${ilikeOp} $2 OR customer_email ${ilikeOp} $2)
         ORDER BY updated_at DESC LIMIT $3`,
        [tenantId, like, limit],
      ),
      query(
        `SELECT id, name, email, phone, channel, total_conversations, last_seen_at
         FROM customer_profiles
         WHERE tenant_id = $1
           AND (name ${ilikeOp} $2 OR email ${ilikeOp} $2 OR phone ${ilikeOp} $2)
         ORDER BY last_seen_at DESC LIMIT $3`,
        [tenantId, like, limit],
      ),
      retrieveKnowledge(q, Math.min(limit, 5), tenantId).catch(() => []),
    ]);

    return NextResponse.json({
      conversations: convRes.rows,
      customers: custRes.rows,
      knowledge: kbResults.map(r => ({ title: r.title ?? "", content: r.content.slice(0, 200), source: r.source ?? "" })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
