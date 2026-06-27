// Internal agent notes on conversations.
// Visible only to authenticated agents — never surfaced to end customers.
// Stored in the messages table with role="note" (filtered out of customer-facing responses).
//
// GET /api/conversations/[id]/notes — list all notes
// POST /api/conversations/[id]/notes — add a note { content }

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const result = await query(
    `SELECT id, role, content, agent_id, created_at
     FROM messages
     WHERE conversation_id = $1 AND tenant_id = $2 AND role = 'note'
     ORDER BY created_at ASC`,
    [id, tenantId]
  );

  return NextResponse.json({ notes: result.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let content = "";
  try {
    const body = await req.json();
    content = String(body.content ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 10000) {
    return NextResponse.json({ error: "Note exceeds 10,000 character limit" }, { status: 400 });
  }

  // Verify conversation belongs to tenant
  const conv = await query(
    `SELECT id FROM conversations WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (conv.rows.length === 0) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const agentId = (auth as { user: { userId: string } }).user.userId;
  const noteId = randomUUID();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO messages (id, tenant_id, conversation_id, role, content, agent_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [noteId, tenantId, id, "note", content, agentId, now]
  );

  return NextResponse.json({
    note: { id: noteId, role: "note", content, agent_id: agentId, created_at: now },
  }, { status: 201 });
}
