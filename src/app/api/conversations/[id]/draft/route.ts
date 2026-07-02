// AI draft reply endpoint — generate a context-aware response draft.
// POST /api/conversations/:id/draft
// Returns: { draft: string }
// Uses the active playbook if one is assigned, otherwise falls back to a
// general customer-support system prompt combined with RAG knowledge.

import { NextRequest, NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import { messageRepo } from "@/lib/repositories";
import { playbookRepo } from "@/lib/repositories";
import { retrieveKnowledge } from "@/lib/rag";
import { chat } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);

  const messages = await messageRepo.findByConversation(id);
  if (!messages.length) {
    return NextResponse.json({ draft: "" });
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  if (!lastUserMsg) {
    return NextResponse.json({ draft: "" });
  }

  const recentText = messages.slice(-10).map(m =>
    `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`
  ).join("\n");

  const [kbDocs, activePlaybooks] = await Promise.all([
    retrieveKnowledge(lastUserMsg.content, 4, tenantId).catch(() => []),
    playbookRepo.findActive(tenantId).catch(() => []),
  ]);

  const activePlaybook = activePlaybooks[0] ?? null;
  const kbContext = kbDocs.map(d => d.content).join("\n\n");

  const personaSection = activePlaybook?.persona
    ? `You are ${activePlaybook.persona}`
    : "You are a helpful, professional customer support agent.";

  const instructionsSection = activePlaybook?.instructions?.length
    ? `\n\nInstructions to follow:\n${activePlaybook.instructions.map((ins, i) => `${i + 1}. ${ins}`).join("\n")}`
    : "";

  const policiesSection = activePlaybook?.policies?.length
    ? `\n\nPolicies:\n${(activePlaybook.policies as {text: string; severity: string}[]).map(p => `- [${p.severity}] ${p.text}`).join("\n")}`
    : "";

  const kbSection = kbContext ? `\n\nRelevant knowledge base context:\n${kbContext}` : "";

  const systemPrompt = `${personaSection}${instructionsSection}${policiesSection}${kbSection}

Write a single, complete reply to the customer's latest message. The reply should:
- Be natural and conversational
- Address the customer's specific concern
- Be concise (2-4 sentences unless more detail is needed)
- NOT include greetings like "Hello!" or sign-offs like "Best regards"
- Match the tone of the conversation

Respond with ONLY the reply text, nothing else.`;

  try {
    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Recent conversation:\n${recentText}\n\nWrite a reply to the customer's latest message:` },
      ],
      "fast",
    );

    return NextResponse.json({ draft: result.content.trim() });
  } catch {
    return NextResponse.json({ draft: "" });
  }
}
