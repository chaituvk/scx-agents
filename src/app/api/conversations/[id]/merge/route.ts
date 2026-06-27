// Merge duplicate conversations.
// POST /api/conversations/[id]/merge
// Body: { source_id: string }  — merge source into [id] (the "primary")
//
// Effect:
// - All messages from source are re-parented to the primary conversation
// - Tags from source are added to primary
// - Notes from source are re-parented to primary
// - Source conversation is closed with a "merged" note
// - CSAT rating is kept on whichever conversation already has one

import { NextRequest, NextResponse } from "next/server";
import { conversationRepo } from "@/lib/repositories";
import { query, run } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: primaryId } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const caller = (auth as { user: { userId: string } }).user;

  let body: { source_id?: string } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceId = body.source_id;
  if (!sourceId) {
    return NextResponse.json({ error: "source_id is required" }, { status: 400 });
  }
  if (sourceId === primaryId) {
    return NextResponse.json({ error: "Cannot merge a conversation with itself" }, { status: 400 });
  }

  // Verify both conversations exist and belong to this tenant
  const [primary, source] = await Promise.all([
    conversationRepo.findById(primaryId),
    conversationRepo.findById(sourceId),
  ]);

  if (!primary || (primary as { tenant_id?: string }).tenant_id !== tenantId) {
    return NextResponse.json({ error: "Primary conversation not found" }, { status: 404 });
  }
  if (!source || (source as { tenant_id?: string }).tenant_id !== tenantId) {
    return NextResponse.json({ error: "Source conversation not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 1. Re-parent messages from source → primary
  await run(
    `UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2 AND tenant_id = $3`,
    [primaryId, sourceId, tenantId]
  );

  // 2. Re-parent notes
  await run(
    `UPDATE conversation_notes SET conversation_id = $1 WHERE conversation_id = $2 AND tenant_id = $3`,
    [primaryId, sourceId, tenantId]
  ).catch(() => {});

  // 3. Copy tags from source to primary (ignore duplicates)
  const sourceTags = await query(
    `SELECT tag FROM conversation_tags WHERE conversation_id = $1 AND tenant_id = $2`,
    [sourceId, tenantId]
  ).catch(() => ({ rows: [] }));
  for (const row of sourceTags.rows) {
    await run(
      `INSERT INTO conversation_tags (conversation_id, tenant_id, tag, created_at)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [primaryId, tenantId, row.tag, now]
    ).catch(() => {});
  }

  // 4. If source has a CSAT and primary doesn't, move it
  const primaryCsat = await query(
    `SELECT id FROM csat_ratings WHERE conversation_id = $1`,
    [primaryId]
  ).catch(() => ({ rows: [] }));
  if (primaryCsat.rows.length === 0) {
    await run(
      `UPDATE csat_ratings SET conversation_id = $1 WHERE conversation_id = $2`,
      [primaryId, sourceId]
    ).catch(() => {});
  }

  // 5. Add a merge note to the primary conversation
  await run(
    `INSERT INTO conversation_notes (id, conversation_id, tenant_id, agent_id, content, is_private, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      crypto.randomUUID(), primaryId, tenantId, caller.userId,
      `Merged from conversation ${sourceId}`, true, now,
    ]
  ).catch(() => {});

  // 6. Close and mark source as merged
  await run(
    `UPDATE conversations SET status = 'closed', updated_at = $1 WHERE id = $2 AND tenant_id = $3`,
    [now, sourceId, tenantId]
  );

  // 7. Add "merged" tag to source so it's identifiable
  await run(
    `INSERT INTO conversation_tags (conversation_id, tenant_id, tag, created_at)
     VALUES ($1, $2, 'merged', $3) ON CONFLICT DO NOTHING`,
    [sourceId, tenantId, now]
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    primary_id: primaryId,
    source_id: sourceId,
    merged_at: now,
  });
}
