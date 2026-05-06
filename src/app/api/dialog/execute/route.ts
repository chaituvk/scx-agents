// /api/dialog/execute — legacy entry point. As of Stage 4 this delegates to
// orchestrator.runTurn() and adapts the result back to the legacy response
// shape so existing chat UI / widget consumers don't have to change.
//
// First-turn LLM-mode welcome is preserved inline (orchestrator has no
// "welcome" concept; it answers a user message). Stage 5+ may move
// welcome generation into a sub-agent.

import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const { conversationId, journeyId, message } = await req.json();
    const tenantId = await getTenantFromRequest(req);

    const conversation = await conversationRepo.findByIdForTenant(conversationId, tenantId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    let dbState = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
    const resolvedJourneyId = journeyId || dbState?.journey_id || "";
    const journey = resolvedJourneyId ? await journeyRepo.findByIdForTenant(resolvedJourneyId, tenantId) : null;

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const tenantAccess = assertTenantAccess({ tenantId, conversation, dialogState: dbState, journey });
    if (!tenantAccess.ok) {
      return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status });
    }

    const mode = journey.execution_mode || "deterministic";

    // ── LLM welcome (first turn, no persisted state) — preserved inline ──
    if (mode === "llm" && !dbState) {
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

    // ── Delegate to orchestrator (user message persisted after — H2 fix:  ──
    //    persisting before would let memory.load read it, which respondSkill
    //    would then append again, duplicating the user turn in the LLM prompt.
    const forceSubAgent: SubAgentName = mode === "llm" ? "rag" : "workflow";
    const turn = await orchestrator.runTurn({
      tenantId,
      conversationId,
      message,
      variables: (dbState?.variables as Record<string, string> | undefined) ?? {},
      requestedJourneyId: journey.id,
      forceSubAgent,
    });

    // For LLM/rag path, the sub-agent doesn't touch dialog_states — keep the
    // row's variables fresh so downstream callers (and the next turn) see the
    // updated state. workflow-agent already persists for its own path.
    if (forceSubAgent === "rag") {
      await dialogStateRepo.upsertByConversationForTenant(tenantId, conversationId, {
        journey_id: journey.id,
        current_node_id: "llm",
        variables: turn.variables,
        context: { mode: "llm", lastMessage: message },
        done: turn.done ? 1 : 0,
      });
    }

    // Re-read state to surface the freshly persisted currentNodeId for the UI.
    const latest = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
    const currentNodeId = latest?.current_node_id ?? "";

    // Persist user + assistant messages after orchestrator (see H2 above).
    await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });
    await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "assistant", content: turn.response });

    await updateConversationLifecycle(conversationId, turn.done, turn.actions);

    return NextResponse.json({
      messages: turn.response ? [turn.response] : [],
      done: turn.done,
      actions: turn.actions,
      mode,
      state: { currentNodeId, variables: turn.variables },
      // Legacy passthroughs the chat UI optionally renders:
      toolCalls: turn.toolCalls,
      knowledgeUsed: turn.citations?.map((source) => ({ source, title: source, content: "", relevance: 1 })),
      guardrailTriggered: turn.supervisor.pass ? undefined : turn.supervisor.issues.map((i) => i.detail).join("; "),
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Dialog execution failed", details: detail }, { status: 400 });
  }
}
