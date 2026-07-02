// Quality review queue: list AI messages flagged for QA review.
// GET /api/quality — paginated list of AI messages to review
// POST /api/quality/:id/review — submit a review for a message

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "quality", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const verdict = url.searchParams.get("verdict"); // "pending" | "approved" | "flagged" | "corrected"
  const days = parseInt(url.searchParams.get("days") ?? "7", 10);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const conditions: string[] = [
    "m.tenant_id = $1",
    "m.role = 'assistant'",
    "m.created_at >= $2",
  ];
  const params: unknown[] = [tenantId, since];
  let idx = 3;

  if (verdict && verdict !== "all") {
    conditions.push(`COALESCE(qr.verdict, 'pending') = $${idx++}`);
    params.push(verdict);
  }

  const where = conditions.join(" AND ");

  const countRes = await query(
    `SELECT COUNT(*) AS total
     FROM messages m
     LEFT JOIN quality_reviews qr ON qr.message_id = m.id AND qr.tenant_id = m.tenant_id
     WHERE ${where}`,
    params as string[]
  ).catch(() => ({ rows: [{ total: 0 }] }));

  params.push(limit);
  params.push(offset);
  const dataRes = await query(
    `SELECT m.id, m.conversation_id, m.content, m.created_at,
            COALESCE(qr.verdict, 'pending') AS verdict,
            qr.rating, qr.comment, qr.corrected_content, qr.reviewed_by, qr.reviewed_at
     FROM messages m
     LEFT JOIN quality_reviews qr ON qr.message_id = m.id AND qr.tenant_id = m.tenant_id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params as string[]
  ).catch(() => ({ rows: [] }));

  return NextResponse.json({
    total: Number(countRes.rows[0]?.total ?? 0),
    limit,
    offset,
    messages: dataRes.rows,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "quality", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const caller = (auth as { user: { userId: string } }).user;

  const body = await req.json();
  const { message_id, verdict, rating, comment, corrected_content } = body;

  if (!message_id || !verdict) {
    return NextResponse.json({ error: "message_id and verdict required" }, { status: 400 });
  }
  if (!["approved", "flagged", "corrected"].includes(verdict)) {
    return NextResponse.json({ error: "verdict must be approved, flagged, or corrected" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Upsert quality review
  await run(
    `INSERT INTO quality_reviews (id, tenant_id, message_id, verdict, rating, comment, corrected_content, reviewed_by, reviewed_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id, message_id) DO UPDATE SET
       verdict = EXCLUDED.verdict,
       rating = EXCLUDED.rating,
       comment = EXCLUDED.comment,
       corrected_content = EXCLUDED.corrected_content,
       reviewed_by = EXCLUDED.reviewed_by,
       reviewed_at = EXCLUDED.reviewed_at`,
    [id, tenantId, message_id, verdict, rating ?? null, comment ?? null, corrected_content ?? null, caller.userId, now, now]
  ).catch((err) => {
    // Table may not exist yet — silently handle
    throw err;
  });

  return NextResponse.json({ review: { id, message_id, verdict, rating, comment, reviewed_at: now } }, { status: 201 });
}
