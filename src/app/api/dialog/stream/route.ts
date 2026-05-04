import { NextRequest } from "next/server";
import { journeyRepo, dialogStateRepo, messageRepo, agentRepo, conversationRepo } from "@/lib/repositories";
import { DialogEngine } from "@/lib/dialog/engine";
import { runAgentStep, runAgentWelcome, type AgentConfig } from "@/lib/agent-runtime";
import type { DialogState as EngineDialogState } from "@/lib/dialog/types";
import { getTenantFromRequest } from "@/lib/tenant";
import { loadTenantRuntime } from "@/lib/runtime/tenant-runtime";
import { NodeLevelHybridExecutor } from "@/lib/runtime/hybrid-executor";
import { assertTenantAccess } from "@/lib/runtime/tenant-guard";

function toEngineState(dbState: any): EngineDialogState {
  return {
    conversationId: dbState.conversation_id,
    journeyId: dbState.journey_id || "",
    currentNodeId: dbState.current_node_id || "",
    variables: dbState.variables || {},
    history: dbState.history || [],
    context: dbState.context || {},
  };
}

async function updateConversationLifecycle(conversationId: string, done: boolean, actions: any[]) {
  const hasTransfer = actions.some((a: any) => a.type === "transfer" || a.type === "escalate");
  if (hasTransfer) {
    await conversationRepo.update(conversationId, { status: "escalated", updated_at: new Date().toISOString() });
  } else if (done) {
    await conversationRepo.update(conversationId, { status: "resolved", updated_at: new Date().toISOString() });
  }
}

function sendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: string, data: any) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

async function* streamWords(text: string) {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    yield word;
  }
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

        sendEvent(controller, encoder, "start", { mode: journey.execution_mode || "deterministic", journey: journey.name });

        const mode = journey.execution_mode || "deterministic";

        if (mode === "deterministic") {
          let result: any;
          let engineState: EngineDialogState;

          if (!dbState) {
            engineState = DialogEngine.createState(conversationId, journey.id);
            const engine = new DialogEngine(journey as any);
            result = engine.start(engineState);

            dbState = await dialogStateRepo.create({
              tenant_id: tenantId,
              conversation_id: conversationId,
              journey_id: journey.id,
              current_node_id: engineState.currentNodeId,
              variables: engineState.variables,
              history: engineState.history,
              context: {},
              done: 0,
            });
          } else {
            engineState = toEngineState(dbState);
            const engine = new DialogEngine(journey as any);
            engineState.context.lastMessage = message;
            result = engine.handleInput(engineState, message);

            await dialogStateRepo.update(dbState.id, {
              current_node_id: engineState.currentNodeId,
              variables: engineState.variables,
              history: engineState.history,
              context: engineState.context,
              done: result.done ? 1 : 0,
            });
          }

          sendEvent(controller, encoder, "node", { nodeId: engineState.currentNodeId, variables: engineState.variables });
          for (const msg of result.messages || []) {
            for await (const word of streamWords(msg)) {
              sendEvent(controller, encoder, "chunk", { text: word });
            }
            sendEvent(controller, encoder, "message", { text: msg });
          }
          for (const action of result.actions || []) {
            sendEvent(controller, encoder, "action", action);
          }
          await updateConversationLifecycle(conversationId, result.done, result.actions || []);
          sendEvent(controller, encoder, "done", { done: result.done, state: { currentNodeId: engineState.currentNodeId, variables: engineState.variables } });
          controller.close();
          return;
        }

        if (mode === "llm") {
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

          if (!dbState) {
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
            for await (const word of streamWords(welcome)) {
              sendEvent(controller, encoder, "chunk", { text: word });
            }
            sendEvent(controller, encoder, "done", { done: false, state: { variables: {} } });
            controller.close();
            return;
          }

          await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });
          sendEvent(controller, encoder, "thinking", { status: "processing" });

          const history = await messageRepo.findByConversation(conversationId);
          const step = await runAgentStep(config, {
            conversationId,
            variables: dbState.variables || {},
            history,
          }, message);

          if (step.toolCalls?.length) {
            for (const tc of step.toolCalls) sendEvent(controller, encoder, "tool", tc);
          }
          if (step.knowledgeUsed?.length) {
            for (const kb of step.knowledgeUsed) sendEvent(controller, encoder, "knowledge", kb);
          }
          if (step.guardrailTriggered) {
            sendEvent(controller, encoder, "guardrail", { triggered: step.guardrailTriggered });
          }

          await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "assistant", content: step.response, agent_id: agent.id });
          for await (const word of streamWords(step.response)) {
            sendEvent(controller, encoder, "chunk", { text: word });
          }
          sendEvent(controller, encoder, "message", { text: step.response });

          const newVars = { ...(dbState.variables || {}), ...(step.variables || {}) };
          await dialogStateRepo.update(dbState.id, {
            variables: newVars,
            context: { ...dbState.context, lastMessage: message },
            done: step.done ? 1 : 0,
          });

          await updateConversationLifecycle(conversationId, step.done, step.actions || []);
          sendEvent(controller, encoder, "done", { done: step.done, state: { variables: newVars } });
          controller.close();
          return;
        }

        if (mode === "hybrid") {
          const tenantRuntime = await loadTenantRuntime(tenantId);
          const hybridEngine = new NodeLevelHybridExecutor(journey as any, tenantRuntime);

          if (!dbState) {
            const engineState = DialogEngine.createState(conversationId, journey.id);
            const result = await hybridEngine.start(engineState);

            dbState = await dialogStateRepo.create({
              tenant_id: tenantId,
              conversation_id: conversationId,
              journey_id: journey.id,
              current_node_id: engineState.currentNodeId,
              variables: engineState.variables,
              history: engineState.history,
              context: engineState.context,
              done: 0,
            });

            for (const msg of result.messages || []) {
              for await (const word of streamWords(msg)) {
                sendEvent(controller, encoder, "chunk", { text: word });
              }
              sendEvent(controller, encoder, "message", { text: msg });
            }
            sendEvent(controller, encoder, "done", { done: result.done, state: { currentNodeId: engineState.currentNodeId, variables: engineState.variables } });
            controller.close();
            return;
          }

          const engineState = toEngineState(dbState);
          const result = await hybridEngine.handleInput(engineState, message);

          for (const msg of result.messages || []) {
            for await (const word of streamWords(msg)) {
              sendEvent(controller, encoder, "chunk", { text: word });
            }
            sendEvent(controller, encoder, "message", { text: msg });
          }

          await dialogStateRepo.update(dbState.id, {
            current_node_id: result.state.currentNodeId,
            variables: result.state.variables,
            history: result.state.history,
            context: { ...result.state.context, lastMessage: message },
            done: result.done ? 1 : 0,
          });

          await updateConversationLifecycle(conversationId, result.done, result.actions || []);
          sendEvent(controller, encoder, "done", { done: result.done, state: { currentNodeId: result.state.currentNodeId, variables: result.state.variables } });
          controller.close();
          return;
        }

        sendEvent(controller, encoder, "error", { message: `Unknown execution mode: ${mode}` });
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
      JSON.stringify({ error: "Dialog stream failed", details: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
