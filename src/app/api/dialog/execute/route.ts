import { NextRequest, NextResponse } from "next/server";
import { journeyRepo, dialogStateRepo, messageRepo, agentRepo, conversationRepo } from "@/lib/repositories";
import { DialogEngine } from "@/lib/dialog/engine";
import { HybridEngine } from "@/lib/hybrid-engine";
import { runAgentStep, runAgentWelcome, type AgentConfig } from "@/lib/agent-runtime";
import type { DialogState as EngineDialogState } from "@/lib/dialog/types";
import { getTenantFromRequest } from "@/lib/tenant";

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

function fromEngineState(state: EngineDialogState): any {
  return {
    conversation_id: state.conversationId,
    journey_id: state.journeyId,
    current_node_id: state.currentNodeId,
    variables: state.variables,
    history: state.history,
    context: state.context,
    done: 0,
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

export async function POST(req: NextRequest) {
  try {
    const { conversationId, journeyId, message } = await req.json();
    const tenantId = await getTenantFromRequest(req);

    let dbState = await dialogStateRepo.findByConversation(conversationId);
    const journey = await journeyRepo.findById(journeyId || dbState?.journey_id || "");

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const mode = journey.execution_mode || "deterministic";

    // ── MODE 1: DETERMINISTIC ──
    if (mode === "deterministic") {
      if (!dbState) {
        const engineState = DialogEngine.createState(conversationId, journey.id);
        const engine = new DialogEngine(journey as any);
        const result = engine.start(engineState);

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

        return NextResponse.json({
          messages: result.messages,
          done: result.done,
          actions: result.actions,
          mode: "deterministic",
          state: { currentNodeId: engineState.currentNodeId, variables: engineState.variables },
        });
      }

      const engineState = toEngineState(dbState);
      const engine = new DialogEngine(journey as any);
      engineState.context.lastMessage = message;
      const result = engine.handleInput(engineState, message);

      await dialogStateRepo.update(dbState.id, {
        current_node_id: engineState.currentNodeId,
        variables: engineState.variables,
        history: engineState.history,
        context: engineState.context,
        done: result.done ? 1 : 0,
      });

      await updateConversationLifecycle(conversationId, result.done, result.actions || []);

      return NextResponse.json({
        messages: result.messages,
        done: result.done,
        actions: result.actions,
        mode: "deterministic",
        state: { currentNodeId: engineState.currentNodeId, variables: engineState.variables },
      });
    }

    // ── MODE 2: LLM ──
    if (mode === "llm") {
      const agents = await agentRepo.findAll(tenantId);
      const agent = agents.find((a) => a.id === journey.id) || agents[0];
      if (!agent) {
        return NextResponse.json({ error: "No agent configured for LLM mode" }, { status: 400 });
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

      const messages = await messageRepo.findByConversation(conversationId);

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

        return NextResponse.json({
          messages: [welcome],
          done: false,
          actions: [{ type: "wait_input", payload: {} }],
          mode: "llm",
          state: { variables: {} },
        });
      }

      await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });

      const step = await runAgentStep(config, {
        conversationId,
        variables: dbState.variables || {},
        history: messages,
      }, message);

      await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "assistant", content: step.response, agent_id: agent.id });

      const newVars = { ...(dbState.variables || {}), ...(step.variables || {}) };
      await dialogStateRepo.update(dbState.id, {
        variables: newVars,
        context: { ...dbState.context, lastMessage: message },
        done: step.done ? 1 : 0,
      });

      await updateConversationLifecycle(conversationId, step.done, step.actions || []);

      return NextResponse.json({
        messages: [step.response],
        done: step.done,
        actions: step.actions,
        mode: "llm",
        guardrailTriggered: step.guardrailTriggered,
        toolCalls: step.toolCalls,
        knowledgeUsed: step.knowledgeUsed,
        state: { variables: newVars },
      });
    }

    // ── MODE 3: HYBRID ──
    if (mode === "hybrid") {
      const agents = await agentRepo.findAll(tenantId);
      const agent = agents.find((a) => a.id === journey.id) || agents[0];
      if (!agent) {
        return NextResponse.json({ error: "No agent configured for hybrid mode" }, { status: 400 });
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
      };

      const hybridEngine = new HybridEngine(journey as any, config);
      const messages = await messageRepo.findByConversation(conversationId);

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
          context: { hybridState: result.hybridState },
          done: 0,
        });

        return NextResponse.json({
          messages: result.messages,
          done: result.done,
          actions: result.actions,
          mode: "hybrid",
          hybridState: result.hybridState,
          state: { currentNodeId: engineState.currentNodeId, variables: engineState.variables },
        });
      }

      const engineState = toEngineState(dbState);
      const hybridState = (dbState.context as any)?.hybridState || { mode: "journey" };

      const result = await hybridEngine.handleInput(
        engineState,
        hybridState,
        { conversationId, variables: dbState.variables || {}, history: messages },
        message
      );

      await dialogStateRepo.update(dbState.id, {
        current_node_id: result.state.currentNodeId,
        variables: result.state.variables,
        history: result.state.history,
        context: { hybridState: result.hybridState, lastMessage: message },
        done: result.done ? 1 : 0,
      });

      await updateConversationLifecycle(conversationId, result.done, result.actions || []);

      return NextResponse.json({
        messages: result.messages,
        done: result.done,
        actions: result.actions,
        mode: "hybrid",
        hybridState: result.hybridState,
        state: { currentNodeId: result.state.currentNodeId, variables: result.state.variables },
      });
    }

    return NextResponse.json({ error: `Unknown execution mode: ${mode}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Dialog execution failed", details: message }, { status: 400 });
  }
}
