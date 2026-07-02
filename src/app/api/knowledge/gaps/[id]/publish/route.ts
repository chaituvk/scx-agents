// POST /api/knowledge/gaps/:id/publish
// Creates a KB source entry from the gap's suggested answer and marks the gap resolved.
// Body: { title?: string; content?: string }

import { NextRequest, NextResponse } from "next/server";
import { knowledgeGapRepo, knowledgeSourceRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { indexKnowledgeSource } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);

  const gap = await knowledgeGapRepo.findById(id);
  if (!gap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gap.tenant_id && gap.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { title?: string; content?: string } = {};
  try { body = await req.json(); } catch { /* use gap defaults */ }

  const title = body.title || gap.question;
  const content = body.content || gap.suggested_answer;

  if (!content) {
    return NextResponse.json(
      { error: "No content to publish — run /suggest first or supply content in body" },
      { status: 400 }
    );
  }

  // Create a knowledge source record for the new FAQ entry
  const source = await knowledgeSourceRepo.create({
    tenant_id: tenantId,
    name: `FAQ: ${title.slice(0, 80)}`,
    type: "faq",
    status: "active",
    entries: 1,
    config: { origin: "knowledge_gap", gap_id: id },
  });

  // Index content into knowledge_embeddings for immediate RAG retrieval (PG only, no-op on SQLite)
  await indexKnowledgeSource(tenantId, source.id, `${title}\n\n${content}`).catch(() => {});

  // Mark gap as resolved
  const resolved = await knowledgeGapRepo.update(id, { status: "resolved", suggested_answer: content });

  return NextResponse.json({ ok: true, source, gap: resolved }, { status: 201 });
}
