// Orchestrator — owns the turn loop. Loads memory + session state, asks the
// router (triage skill enriched with session context + tenant intent map) to
// classify the turn, dispatches to a sub-agent, runs the supervisor, audits,
// and persists session-state updates (last_intent, topic_stack).
//
// Topic stack model (Stage 5 #7): the user's active workflow lives in
// dialog_states.journey_id (set + maintained by workflow-agent). When the
// user takes a knowledge detour mid-workflow, the orchestrator pushes a
// frame onto topic_stack so the system remembers what to return to. When
// the user comes back to the active workflow, the top frame is popped.

import { memoryService } from "../memory";
import { triageSkill } from "../skills";
import { selectSubAgent } from "../agents/registry";
import { supervisorAgent } from "../agents/supervisor";
import { makeAuditEmitter } from "../audit";
import { journeyRepo, dialogStateRepo, messageRepo } from "../repositories";
import { loadTenantRuntime } from "../runtime/tenant-runtime";
import { formatResponse, type Channel } from "../formatters/channel";
import type {
  OrchestratorTurnInput,
  OrchestratorTurnOutput,
  PendingApproval,
  SkillContext,
  SubAgentRunOutput,
  SupervisorCheckOutput,
  TopicFrame,
  TriageOutput,
  SubAgentName,
  MemoryContext,
} from "../agents/types";

const KNOWN_INTENTS = [
  "knowledge_query",
  "return_request",
  "refund_request",
  "order_status",
  "kyc_verification",
  "promo_apply",
  "escalate",
  "greeting",
  "continue_workflow",
  "general_chat",
  "smalltalk",
  "acknowledgment",
];

interface SessionSnapshot {
  activeJourneyId: string | null;
  currentNodeId: string | null;
  activeAgent: SubAgentName | null;
  lastIntent: string | null;
  topicStack: TopicFrame[];
  pendingApproval: PendingApproval | null;
}

async function loadSession(tenantId: string, conversationId: string): Promise<SessionSnapshot> {
  const row = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
  if (!row) {
    return {
      activeJourneyId: null, currentNodeId: null, activeAgent: null,
      lastIntent: null, topicStack: [], pendingApproval: null,
    };
  }
  return {
    activeJourneyId: row.journey_id ?? null,
    currentNodeId: row.current_node_id ?? null,
    activeAgent: (row.active_agent as SubAgentName | null | undefined) ?? null,
    lastIntent: row.last_intent ?? null,
    topicStack: Array.isArray(row.topic_stack) ? (row.topic_stack as TopicFrame[]) : [],
    pendingApproval: row.pending_approval && typeof row.pending_approval === "object"
      ? (row.pending_approval as unknown as PendingApproval)
      : null,
  };
}

async function loadActivePlaybook(tenantId: string): Promise<string | null> {
  try {
    const { playbookRepo } = await import('../repositories/playbook');
    const all = await playbookRepo.findAll(tenantId);
    return all.find((p: { status: string; id: string }) => p.status === 'active')?.id ?? null;
  } catch {
    return null;
  }
}

async function loadIntentMap(tenantId: string): Promise<Record<string, string>> {
  const runtime = await loadTenantRuntime(tenantId);
  const router = runtime.profiles.find((p) => p.kind === "router" && p.status === "active");
  const map: Record<string, string> = {};
  const config = router?.config as { intents?: Array<{ intent?: unknown; journey_id?: unknown }> } | undefined;
  if (Array.isArray(config?.intents)) {
    for (const entry of config.intents) {
      if (typeof entry?.intent === "string" && typeof entry?.journey_id === "string") {
        map[entry.intent] = entry.journey_id;
      }
    }
  }
  return map;
}

// Topic-stack push/pop based on triage outcome relative to the active workflow.
function reconcileTopicStack(
  session: SessionSnapshot,
  triage: TriageOutput,
  subAgent: SubAgentName,
): TopicFrame[] {
  const stack = [...session.topicStack];

  // Returning to active workflow → pop the top frame if it matches.
  if (subAgent === "workflow" && session.activeJourneyId &&
      (!triage.journeyId || triage.journeyId === session.activeJourneyId) &&
      stack.length > 0 && stack[stack.length - 1].journeyId === session.activeJourneyId) {
    stack.pop();
    return stack;
  }

  // Detour from active workflow → push a frame so we remember the position.
  if (subAgent !== "workflow" && subAgent !== "escalation" && session.activeJourneyId) {
    const top = stack[stack.length - 1];
    const alreadyTracking = top && top.journeyId === session.activeJourneyId && top.nodeId === session.currentNodeId;
    if (!alreadyTracking) {
      stack.push({
        intent: session.lastIntent ?? "workflow",
        journeyId: session.activeJourneyId,
        nodeId: session.currentNodeId ?? undefined,
        pushedAt: new Date().toISOString(),
      });
    }
  }

  return stack;
}

export class Orchestrator {
  async runTurn(input: OrchestratorTurnInput): Promise<OrchestratorTurnOutput> {
    const audit = makeAuditEmitter(input.conversationId, input.tenantId);
    const ctx: SkillContext = {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      audit,
    };

    await audit.emit("turn_start", { message: input.message });

    // 1. Load memory + session state + tenant intent map + active playbook in parallel.
    const [memCtx, session, intentMap, activePlaybookId] = await Promise.all([
      memoryService.load({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        customerId: input.customerId,
      }),
      loadSession(input.tenantId, input.conversationId),
      loadIntentMap(input.tenantId),
      loadActivePlaybook(input.tenantId),
    ]);

    // 1b. Pending-approval gate (Stage 7). When a prior turn paused on a
    // policy_check, the conversation is suspended until POST
    // /api/orchestrator/approve clears dialog_states.pending_approval.
    // Hint-driven turns (forceSubAgent / requestedJourneyId) bypass the
    // gate so /api/orchestrator/approve can drive a synthetic resume turn.
    if (session.pendingApproval && !input.forceSubAgent && !input.requestedJourneyId) {
      await audit.emit("policy_event", {
        decision: "deny", target: "turn",
        reason: `held_for_approval:${session.pendingApproval.id}`,
      });
      const heldResponse =
        "This conversation is awaiting supervisor approval — I'll continue once it's cleared.";
      const supervisor: SupervisorCheckOutput = { pass: true, issues: [] };
      await audit.emit("turn_end", {
        subAgent: session.activeAgent ?? "workflow",
        done: false, supervisorPass: true, heldForApproval: true,
      });
      return {
        response: heldResponse,
        subAgent: session.activeAgent ?? "workflow",
        intent: "held_for_approval",
        variables: input.variables ?? {},
        supervisor,
        done: false,
        actions: [],
        pendingApproval: session.pendingApproval,
      };
    }

    // 2. Triage — session-aware, intent-mapped via router profile.
    //    Hint path: skipped when caller supplies forceSubAgent or
    //    requestedJourneyId (legacy /api/dialog/* adapters).
    let triage: TriageOutput;
    if (input.forceSubAgent || input.requestedJourneyId) {
      let subAgent = input.forceSubAgent;
      if (!subAgent && input.requestedJourneyId) {
        const journey = await journeyRepo.findByIdForTenant(input.requestedJourneyId, input.tenantId);
        subAgent = journey?.execution_mode === "llm" ? "rag" : "workflow";
      }
      triage = {
        intent: "forced",
        subAgent: subAgent ?? "workflow",
        journeyId: input.requestedJourneyId,
        confidence: 1.0,
        rationale: "forced via caller hint",
      };
    } else {
      triage = await triageSkill.run(
        {
          message: input.message,
          history: memCtx.history,
          knownIntents: KNOWN_INTENTS,
          session: {
            activeJourneyId: session.activeJourneyId,
            currentNodeId: session.currentNodeId,
            activeAgent: session.activeAgent,
            lastIntent: session.lastIntent,
            topicStackDepth: session.topicStack.length,
          },
          intentMap,
        },
        ctx
      );
    }

    // If an active playbook is configured for this tenant, prefer it over
    // the triage-selected sub-agent (unless triage selected escalation or a
    // forced/hint-driven route is in effect).
    if (activePlaybookId && !input.forceSubAgent && !input.requestedJourneyId && triage.subAgent !== 'escalation') {
      triage = { ...triage, subAgent: 'playbook', playbookId: activePlaybookId };
    }

    await audit.emit("route_decision", {
      intent: triage.intent,
      subAgent: triage.subAgent,
      journeyId: triage.journeyId,
      playbookId: triage.playbookId,
      confidence: triage.confidence,
      rationale: triage.rationale,
      sessionAware: !input.forceSubAgent && !input.requestedJourneyId,
    });

    // 3. Dispatch to sub-agent (or run collaboration mode when requested).
    const variables = input.variables ?? {};
    let subOut: SubAgentRunOutput;
    let subName: SubAgentName;
    if (input.collaboratingAgents && input.collaboratingAgents.length > 0) {
      const collabResult = await this.collaborate(
        input.collaboratingAgents,
        input,
        ctx,
        memCtx,
        variables,
      );
      subOut = {
        response: collabResult.response,
        variables: collabResult.variables,
        toolCalls: collabResult.toolCalls,
        done: false,
        actions: [],
      };
      subName = input.collaboratingAgents[0];
    } else {
      const sub = selectSubAgent(triage);
      subName = sub.name;
      subOut = await sub.run(
        { message: input.message, triage, context: memCtx, variables },
        ctx
      );
    }

    // Merge agent-written variables back into shared memory context so the
    // updated slots are immediately visible to the supervisor check and any
    // future collaborating agents within the same turn.
    Object.assign(memCtx.ephemeral, subOut.variables);

    // 4. Supervisor check.
    const supervisor = await supervisorAgent.check(
      {
        response: subOut.response,
        citations: subOut.citations,
        passages: memCtx.knowledge,
        variables: subOut.variables,
      },
      ctx
    );

    let finalResponse = subOut.response;
    if (supervisor.rewrittenContent) {
      finalResponse = supervisor.rewrittenContent;
    }

    // 5. Channel formatting — apply before returning when a non-web channel is
    //    specified. This must happen after supervisor rewriting so we format
    //    the final content, not the pre-rewrite draft.
    let formattedChannel: string | undefined;
    if (input.channel && input.channel !== 'web') {
      finalResponse = formatResponse(finalResponse, { channel: input.channel as Channel });
      formattedChannel = input.channel;
    }

    // 6. Topic-stack reconciliation + session state persistence. Only
    //    triage-driven turns update last_intent / topic_stack — hint-driven
    //    turns leave them alone (caller is responsible).
    if (!input.forceSubAgent && !input.requestedJourneyId) {
      const newStack = reconcileTopicStack(session, triage, subName);
      // If the workflow finished on this turn, clear any outstanding stack.
      const finalStack = subName === "workflow" && subOut.done ? [] : newStack;
      try {
        await dialogStateRepo.upsertByConversationForTenant(input.tenantId, input.conversationId, {
          last_intent: triage.intent,
          active_agent: subName,
          topic_stack: finalStack,
        });
      } catch (err) {
        // Persistence is best-effort for the session-state extension; the
        // turn itself still succeeds. Surfacing via audit so it's visible.
        await audit.emit("policy_event", {
          decision: "deny", target: "session_persistence",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 7. Persist user message + assistant response to the messages table so
    //    loadHistory() returns them on the next turn. Fire-and-forget — a
    //    write failure must not fail the turn.
    Promise.all([
      messageRepo.create({
        conversation_id: input.conversationId,
        tenant_id: input.tenantId,
        role: "user",
        content: input.message,
      }),
      messageRepo.create({
        conversation_id: input.conversationId,
        tenant_id: input.tenantId,
        role: "assistant",
        content: finalResponse,
        intent: triage.intent ?? undefined,
        agent_id: subName,
      }),
    ]).catch((err) => console.error("[orchestrator] message persistence failed:", err));

    // 8. Playbook pendingAction → persist as pending_approval so the approval
    //    gate blocks the next turn and /api/orchestrator/approve can resume.
    if (subOut.pendingAction && subName === "playbook") {
      const pendingApproval: PendingApproval = {
        id: subOut.pendingAction.id,
        journeyId: "",
        nodeId: "",
        playbookId: (subOut.pendingAction.params as Record<string, unknown>)?.playbookId as string | undefined,
        subAgent: "playbook",
        reason: subOut.pendingAction.tool,
        triggeringMessage: input.message,
        createdAt: new Date().toISOString(),
      };
      try {
        await dialogStateRepo.upsertByConversationForTenant(input.tenantId, input.conversationId, {
          pending_approval: pendingApproval as unknown as Record<string, unknown>,
          active_agent: "playbook",
        });
      } catch (err) {
        console.error("[orchestrator] playbook approval persistence failed:", err);
      }
    }

    await audit.emit("turn_end", {
      subAgent: subName,
      done: subOut.done,
      supervisorPass: supervisor.pass,
    });

    return {
      response: finalResponse,
      subAgent: subName,
      intent: triage.intent,
      variables: subOut.variables,
      toolCalls: subOut.toolCalls,
      citations: subOut.citations,
      supervisor,
      done: subOut.done,
      actions: subOut.actions,
      pendingApproval: subOut.pendingApproval,
      formattedChannel,
    };
  }

  async collaborate(
    agents: SubAgentName[],
    input: OrchestratorTurnInput,
    ctx: SkillContext,
    memCtx: MemoryContext,
    variables: Record<string, string>,
  ): Promise<{ response: string; variables: Record<string, string>; toolCalls: SubAgentRunOutput['toolCalls'] }> {
    // Run agents in parallel
    const results = await Promise.allSettled(
      agents.map(agentName => {
        const fakeTriage: TriageOutput = {
          intent: 'forced',
          subAgent: agentName,
          confidence: 1.0,
          rationale: 'collaboration',
        };
        const sub = selectSubAgent(fakeTriage);
        return sub.run({ message: input.message, triage: fakeTriage, context: memCtx, variables }, ctx);
      })
    );

    // Merge successful results
    const successful = results
      .filter((r): r is PromiseFulfilledResult<SubAgentRunOutput> => r.status === 'fulfilled')
      .map(r => r.value);

    if (successful.length === 0) throw new Error('All collaborating agents failed');

    // Priority: use the most informative response (longest with citations preferred)
    const best = successful.reduce((a, b) => {
      const aScore = a.response.length + (a.citations?.length ?? 0) * 50;
      const bScore = b.response.length + (b.citations?.length ?? 0) * 50;
      return bScore > aScore ? b : a;
    });

    // Merge all variables and tool calls
    const mergedVars = Object.assign({}, variables, ...successful.map(r => r.variables));
    const mergedToolCalls = successful.flatMap(r => r.toolCalls ?? []);

    return { response: best.response, variables: mergedVars, toolCalls: mergedToolCalls };
  }
}

export const orchestrator = new Orchestrator();
