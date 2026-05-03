import { NextRequest } from "next/server";
import { conversationRepo, agentRepo, messageRepo } from "@/lib/repositories";
import { generateAgentResponse } from "@/lib/ai";

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

    const result = generateAgentResponse(message, activeAgents);
    const assignedAgent = activeAgents.find((a) => a.id === result.agentId);

    if (assignedAgent) {
      await conversationRepo.update(conversationId, {
        agent_id: assignedAgent.id,
        assigned_to: assignedAgent.name,
      });
    }

    const assistantMessage = await messageRepo.create({
      conversation_id: conversationId,
      role: "assistant",
      content: result.response,
      agent_id: result.agentId,
      intent: result.intent,
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        agent: {
          id: result.agentId,
          name: result.agentName,
          intent: result.intent,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to process message", details: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
