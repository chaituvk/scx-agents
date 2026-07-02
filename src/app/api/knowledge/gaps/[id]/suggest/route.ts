// POST /api/knowledge/gaps/:id/suggest
// Generates an AI-drafted answer for an unanswered knowledge gap and stores it.

import { NextRequest, NextResponse } from "next/server";
import { knowledgeGapRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { chat } from "@/lib/llm";
import { retrieveKnowledge } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(_req);

  const gap = await knowledgeGapRepo.findById(id);
  if (!gap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gap.tenant_id && gap.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Retrieve existing KB passages as context to avoid hallucinating known facts
  const docs = await retrieveKnowledge(gap.question, 4, tenantId).catch(() => []);
  const context = docs.map((d) => d.content).join("\n\n") || "No existing content.";

  const messages = [
    {
      role: "system" as const,
      content: `You are a knowledge base writer. Given a customer question that had no answer,
draft a clear, concise FAQ answer (2-4 sentences). Use the existing KB context below to stay
consistent with known policies. If no relevant context exists, write a general best-practice answer
but note "[Needs review]" at the end so a human can verify.

Existing KB context:
${context}`,
    },
    {
      role: "user" as const,
      content: `Customer question: "${gap.question}"\n\nDraft a helpful answer:`,
    },
  ];

  let suggestion: string;
  try {
    const resp = await chat(messages, "balanced");
    suggestion = resp.content.trim();
  } catch {
    return NextResponse.json({ error: "LLM unavailable" }, { status: 503 });
  }

  const updated = await knowledgeGapRepo.update(id, { suggested_answer: suggestion });
  return NextResponse.json({ gap: updated, suggested_answer: suggestion });
}
