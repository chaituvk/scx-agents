// Agent copilot: real-time suggestions for human agents during a conversation.
// POST /api/conversations/:id/copilot
// Returns: { suggestions: string[], intent: string, sentiment: string, canned_matches: CannedResponse[] }

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { messageRepo } from "@/lib/repositories";
import { retrieveKnowledge } from "@/lib/rag";
import { cannedResponseRepo } from "@/lib/repositories/canned-response";
import { chat } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const messages = await messageRepo.findByConversation(id);
  if (!messages.length) {
    return NextResponse.json({ suggestions: [], intent: null, sentiment: null, canned_matches: [] });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return NextResponse.json({ suggestions: [], intent: null, sentiment: null, canned_matches: [] });
  }

  const recentText = messages
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const [kbDocs, allCanned] = await Promise.all([
    retrieveKnowledge(lastUserMsg.content, 3, tenantId).catch(() => []),
    cannedResponseRepo.findAll(tenantId).catch(() => []),
  ]);

  const kbContext = kbDocs.map((d) => d.content).join("\n\n");

  const cannedMatches = allCanned
    .filter((c) => {
      const q = lastUserMsg.content.toLowerCase();
      return (
        c.title.toLowerCase().includes(q.slice(0, 20)) ||
        c.tags.some((t) => q.includes(t.toLowerCase())) ||
        c.category !== "general" && q.includes(c.category.toLowerCase())
      );
    })
    .slice(0, 3);

  let suggestions: string[] = [];
  let intent: string | null = null;
  let sentiment: string | null = null;

  try {
    const systemPrompt = `You are an AI copilot helping a human support agent respond to a customer.
Analyze the conversation and provide exactly 3 short, natural response suggestions the agent could send.
Also identify the customer's likely intent and sentiment.

${kbContext ? `Knowledge base context:\n${kbContext}\n` : ""}

Return JSON:
{
  "intent": "one of: refund_request | technical_issue | billing_question | account_help | general_question | complaint | praise",
  "sentiment": "one of: positive | neutral | negative | frustrated",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Recent conversation:\n${recentText}\n\nProvide copilot suggestions:` },
      ],
      "fast"
    );

    const parsed = JSON.parse(result.content);
    suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [];
    intent = parsed.intent ?? null;
    sentiment = parsed.sentiment ?? null;
  } catch {
    suggestions = [
      "I understand your concern. Let me look into this for you right away.",
      "Thank you for reaching out. Could you provide more details so I can assist you better?",
      "I apologize for the inconvenience. I'll make sure to resolve this promptly.",
    ];
  }

  return NextResponse.json({ suggestions, intent, sentiment, canned_matches: cannedMatches });
}
