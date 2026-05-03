import { NextRequest } from "next/server";
import { conversationRepo, agentRepo, messageRepo } from "@/lib/repositories";
import { streamAgentResponse } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();

    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const agents = await agentRepo.findAll();
    const activeAgents = agents
      .filter((a) => a.status === "production" || a.status === "staging")
      .map((a) => ({
        id: a.id,
        name: a.name,
        goals: a.goals || [],
        skills: a.skills || [],
        guardrails: a.guardrails || [],
        tone: a.name?.includes("Sales") ? "upsell" : "support",
      }));

    await messageRepo.create({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const generator = streamAgentResponse(message, activeAgents);
        let fullResponse = "";
        let agentInfo = { agentId: "", agentName: "" };

        for (const chunk of generator) {
          fullResponse = chunk.chunk;
          agentInfo = { agentId: chunk.agentId, agentName: chunk.agentName };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ chunk: chunk.chunk, agentName: chunk.agentName, done: chunk.done })}

`)
          );
          await new Promise((r) => setTimeout(r, 60));
        }

        await conversationRepo.update(conversationId, {
          agent_id: agentInfo.agentId,
          assigned_to: agentInfo.agentName,
        });

        await messageRepo.create({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
          agent_id: agentInfo.agentId,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to stream", details: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
