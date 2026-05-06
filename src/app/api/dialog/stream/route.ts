// /api/dialog/stream — legacy SSE entry point. As of Stage 4 this delegates
// to orchestrator.runTurn() and fake-streams the response back as SSE events.
// orchestrator turns are non-streaming today; this preserves the per-word
// chunking the chat UI expects without genuinely streaming from the LLM.

import { NextRequest } from "next/server";
import { conversationRepo, dialogStateRepo, journeyRepo, messageRepo, agentRepo } from "@/lib/repositories";
import { orchestrator } from "@/lib/orchestrator";
import { runAgentWelcome, type AgentConfig } from "@/lib/agent-runtime";
import { getTenantFromRequest } from "@/lib/tenant";
import { assertTenantAccess } from "@/lib/runtime/tenant-guard";
import type { SubAgentName } from "@/lib/agents/types";

async function updateConversationLifecycle(conversationId: string, done: boolean, actions: Array<{ type: string }>) {
  const hasTransfer = actions.some((a) => a.type === "transfer" || a.type === "escalate");
  if (hasTransfer) {
    await conversationRepo.update(conversationId, { status: "escalated", updated_at: new Date().toISOString() });
  } else if (done) {
    await conversationRepo.update(conversationId, { status: "resolved", updated_at: new Date().toISOString() });
  }
}

function sendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function* streamWords(text: string) {
  for (const word of text.split(/(\s+)/)) yield word;
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, journeyId, message } = await req.json();
    const tenantId = await getTenantFromRequest(req);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const conversation = await conversationRepo.findByIdForTenant(conversationId, tenantId);
        if (!conversation) {
          sendEvent(controller, encoder, "error", { message: "Conversation not found" });
          controller.close();
          return;
        }

        let dbState = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
        const resolvedJourneyId = journeyId || dbState?.journey_id || "";
        const journey = resolvedJourneyId ? await journeyRepo.findByIdForTenant(resolvedJourneyId, tenantId) : null;

        if (!journey) {
          sendEvent(controller, encoder, "error", { message: "Journey not found" });
          controller.close();
          return;
        }

        const tenantAccess = assertTenantAccess({ tenantId, conversation, dialogState: dbState, journey });
        if (!tenantAccess.ok) {
          sendEvent(controller, encoder, "error", { message: tenantAccess.error || "Tenant access denied" });
          controller.close();
          return;
        }

        const mode = journey.execution_mode || "deterministic";
        sendEvent(controller, encoder, "start", { mode, journey: journey.name });

        // ── LLM welcome (first turn) — preserved inline ──
        if (mode === "llm" && !dbState) {
          const agents = await agentRepo.findAll(tenantId);
          const agent = agents.find((a) => a.id === journey.id) || agents[0];
          if (!agent) {
            sendEvent(controller, encoder, "error", { message: "No agent configured for LLM mode" });
            controller.close();
            return;
          }
          const config: AgentConfig = {
            name: agent.name,
            goals: agent.goals || [],
            guardrails: agent.guardrails || [],
            skills: agent.skills || [],
            tone: agent.tone,
            welcome_message: agent.welcome_message || undefined,
            off_limit_topics: agent.off_limit_topics || [],
            off_limit_phrases: agent.off_limit_phrases || [],
            approval_threshold: agent.approval_threshold,
          };

          dbState = await dialogStateRepo.create({
            tenant_id: tenantId,
            conversation_id: conversationId,
            journey_id: journey.id,
            current_node_id: "llm",
            variables: {},
            history: [],
            context: { mode: "llm" },
            done: 0,
          });

          const welcome = await runAgentWelcome(config);
          await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "assistant", content: welcome, agent_id: agent.id });

          sendEvent(controller, encoder, "node", { nodeId: "llm", variables: {} });
          for await (const word of streamWords(welcome)) {
            sendEvent(controller, encoder, "chunk", { text: word });
          }
          sendEvent(controller, encoder, "message", { text: welcome });
          sendEvent(controller, encoder, "done", {
            done: false,
            state: { currentNodeId: "llm", variables: {} },
          });
          controller.close();
          return;
        }

        // ── Delegate to orchestrator (user message persisted after — see ──
        //    H2 fix: persisting before would let memory.load read it, which
        //    respondSkill would then append again and the LLM prompt would
        //    contain the user's text twice. Order: orchestrator -> persist).
        sendEvent(controller, encoder, "thinking", { status: "processing" });

        const forceSubAgent: SubAgentName = mode === "llm" ? "rag" : "workflow";
        const turn = await orchestrator.runTurn({
          tenantId,
          conversationId,
          message,
          variables: (dbState?.variables as Record<string, string> | undefined) ?? {},
          requestedJourneyId: journey.id,
          forceSubAgent,
        });

        if (forceSubAgent === "rag") {
          await dialogStateRepo.upsertByConversationForTenant(tenantId, conversationId, {
            journey_id: journey.id,
            current_node_id: "llm",
            variables: turn.variables,
            context: { mode: "llm", lastMessage: message },
            done: turn.done ? 1 : 0,
          });
        }

        const latest = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
        const currentNodeId = latest?.current_node_id ?? "";

        // Emit ancillary events the chat UI optionally renders.
        if (turn.toolCalls?.length) {
          for (const tc of turn.toolCalls) sendEvent(controller, encoder, "tool", tc);
        }
        if (turn.citations?.length) {
          for (const source of turn.citations) {
            sendEvent(controller, encoder, "knowledge", { source, title: source, content: "", relevance: 1 });
          }
        }
        if (!turn.supervisor.pass) {
          sendEvent(controller, encoder, "guardrail", {
            triggered: turn.supervisor.issues.map((i) => i.detail).join("; "),
          });
        }
        sendEvent(controller, encoder, "node", { nodeId: currentNodeId, variables: turn.variables });

        // Persist user + assistant messages after orchestrator (see H2 above).
        await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });
        await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "assistant", content: turn.response });
        for await (const word of streamWords(turn.response)) {
          sendEvent(controller, encoder, "chunk", { text: word });
        }
        sendEvent(controller, encoder, "message", { text: turn.response });

        for (const action of turn.actions || []) {
          sendEvent(controller, encoder, "action", action);
        }

        await updateConversationLifecycle(conversationId, turn.done, turn.actions);
        sendEvent(controller, encoder, "done", {
          done: turn.done,
          state: { currentNodeId, variables: turn.variables },
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
    const detail = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Dialog stream failed", details: detail }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
