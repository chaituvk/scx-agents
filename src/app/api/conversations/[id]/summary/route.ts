import { NextRequest, NextResponse } from "next/server";
import { messageRepo } from "@/lib/repositories";
import { chat } from "@/lib/llm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await messageRepo.findByConversation(id);

  if (!messages.length) {
    return NextResponse.json({ summary: "No messages in this conversation." });
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const result = await chat([
    {
      role: "system",
      content: `You are a customer service analyst. Summarize the following conversation concisely:
- What the customer needed
- What the agent did / what was resolved
- Outcome (resolved / escalated / pending)
- Any follow-up actions required
Keep it under 150 words.`,
    },
    { role: "user", content: transcript },
  ]);

  return NextResponse.json({
    summary: result.content,
    message_count: messages.length,
    generated_at: new Date().toISOString(),
  });
}
