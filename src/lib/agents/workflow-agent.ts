// WorkflowAgent — multi-step procedure sub-agent. Dispatches journeys to
// either DialogEngine (deterministic) or NodeLevelHybridExecutor (hybrid)
// based on journey.execution_mode.
//
// Why two engines, not one: NodeLevelHybridExecutor handles every node type
// the dialog graph supports, but its processNodeChain stops on a different
// rule than DialogEngine — hybrid stops on done/wait while DialogEngine also
// stops at legacy `api` nodes and on any non-set_variable action. Routing
// existing deterministic journeys through hybrid would change message and
// turn boundaries on already-recorded conversations. Stage 3 picks the
// right engine per mode; Stage 4+ may unify if hybrid's chain semantics are
// brought into line with DialogEngine's.
//
// Policy gating note: workflow-agent's policyChecker.validateSlotWrite /
// validateToolCall / validateResponse run AFTER the executor has already
// processed the corresponding nodes. They are post-hoc audit + gate (drop
// the action from the response, emit a deny event), NOT pre-execution
// barriers. Pre-execution policy enforcement happens inside the hybrid
// executor itself for llm_extract / tool_call / policy_check / llm_draft
// nodes via runtime profiles. Legacy `api` nodes have no pre-execution
// gate — their side effects fire before policyChecker sees them.

import { DialogEngine, type DialogResult } from "../dialog/engine";
import type { Journey as DialogJourney, DialogState as EngineState } from "../dialog/types";
import { NodeLevelHybridExecutor } from "../runtime/hybrid-executor";
import { loadTenantRuntime } from "../runtime/tenant-runtime";
import { journeyRepo, dialogStateRepo } from "../repositories";
import { policyChecker } from "../policy";
import { emitAuditFromActions, emitJourneyTransitions, type JourneyHistoryEntry } from "../audit/from-actions";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
} from "./types";

const NO_WORKFLOW =
  "I'd love to help with that but I don't have a workflow configured for it yet.";
const SAFE_FALLBACK = "I'm not able to share that information.";

type RawJourney = {
  id: string; name: string; description?: string; status?: string;
  nodes: unknown[]; edges?: unknown[]; variables?: unknown;
  execution_mode?: "deterministic" | "llm" | "hybrid" | string;
  created_at?: string; updated_at?: string;
};

interface ExecutorResult {
  messages: string[];
  state: EngineState;
  done: boolean;
  actions: Array<{ type: string; payload?: Record<string, unknown> }>;
}

function toDialogJourney(j: RawJourney): DialogJourney {
  return {
    id: j.id, name: j.name, description: j.description ?? "",
    status: (j.status as DialogJourney["status"]) ?? "draft",
    nodes: (j.nodes ?? []) as DialogJourney["nodes"],
    edges: (j.edges ?? []) as DialogJourney["edges"],
    variables: Array.isArray(j.variables) ? (j.variables as string[]) : [],
    createdAt: j.created_at ?? new Date().toISOString(),
    updatedAt: j.updated_at ?? new Date().toISOString(),
  };
}

async function resolveJourney(triage: TriageOutput, tenantId: string): Promise<{ journey: DialogJourney; raw: RawJourney } | null> {
  if (triage.journeyId) {
    const j = await journeyRepo.findByIdForTenant(triage.journeyId, tenantId);
    if (j) return { journey: toDialogJourney(j as RawJourney), raw: j as RawJourney };
  }
  const all = await journeyRepo.findAll(tenantId);
  const active = all.find((j) => j.status === "active") ?? all[0];
  return active ? { journey: toDialogJourney(active as RawJourney), raw: active as RawJourney } : null;
}

async function emitPolicy(ctx: SkillContext, target: string, d: { decision: string; reason?: string }) {
  await ctx.audit.emit("policy_event", { decision: d.decision, reason: d.reason, target });
}

function fromDialogResult(state: EngineState, result: DialogResult): ExecutorResult {
  return {
    messages: result.messages,
    state,
    done: result.done,
    actions: result.actions.map((a) => ({ type: a.type, payload: a.payload })),
  };
}

// Build a slot → {source, profile} map from the executor's set_variable
// actions so workflow-agent's slot_write audit preserves provenance for
// values that came from llm_extract or tool_call output mapping.
function indexSlotMetadata(actions: Array<{ type: string; payload?: Record<string, unknown> }>): Map<string, { source?: string; profile?: string }> {
  const map = new Map<string, { source?: string; profile?: string }>();
  for (const action of actions) {
    if (action.type !== "set_variable") continue;
    const payload = action.payload ?? {};
    const slot = (payload.variable ?? payload.slot) as string | undefined;
    if (!slot) continue;
    map.set(slot, {
      source: payload.source as string | undefined,
      profile: payload.profile as string | undefined,
    });
  }
  return map;
}

export const workflowAgent: SubAgent = {
  name: "workflow",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "workflow";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const resolved = await resolveJourney(input.triage, ctx.tenantId);
    if (!resolved) {
      return { response: NO_WORKFLOW, variables: input.variables, done: true, actions: [] };
    }
    const { journey, raw: rawJourney } = resolved;

    const persisted = await dialogStateRepo.findByConversationForTenant(ctx.conversationId, ctx.tenantId);
    const priorVars: Record<string, string> = { ...input.variables };
    let state: EngineState;
    if (persisted && persisted.journey_id === journey.id) {
      state = {
        conversationId: ctx.conversationId, journeyId: journey.id,
        currentNodeId: persisted.current_node_id ?? "",
        variables: { ...(persisted.variables as Record<string, string> | undefined ?? {}), ...input.variables },
        history: (persisted.history as { nodeId: string; timestamp: string }[]) ?? [],
        context: (persisted.context as Record<string, unknown>) ?? {},
      };
    } else {
      state = DialogEngine.createState(ctx.conversationId, journey.id);
      state.variables = { ...input.variables };
    }

    const oldHistory: JourneyHistoryEntry[] = [...((state.history ?? []) as JourneyHistoryEntry[])];

    let result: ExecutorResult;
    if (rawJourney.execution_mode === "hybrid") {
      // Hybrid path: tenant runtime is loaded once per turn for runtime-profile
      // policy gating inside llm_extract / tool_call / policy_check / llm_draft.
      const runtime = await loadTenantRuntime(ctx.tenantId);
      const engine = new NodeLevelHybridExecutor(journey, runtime);
      const hybridResult = state.currentNodeId
        ? await engine.handleInput(state, input.message)
        : await engine.start(state);
      result = {
        messages: hybridResult.messages,
        state: hybridResult.state,
        done: hybridResult.done,
        actions: hybridResult.actions.map((a) => ({ type: a.type, payload: a.payload as Record<string, unknown> | undefined })),
      };
    } else {
      // Deterministic path: DialogEngine preserves the legacy chain-stop
      // semantics (stops at api / non-set_variable actions / input / end).
      const engine = new DialogEngine(journey);
      const dResult = state.currentNodeId
        ? engine.handleInput(state, input.message)
        : engine.start(state);
      result = fromDialogResult(state, dResult);
    }

    const slotMetadata = indexSlotMetadata(result.actions);

    // Validate slot writes vs prior variables.
    const finalVariables: Record<string, string> = { ...priorVars };
    for (const [slot, value] of Object.entries(result.state.variables)) {
      const next = String(value);
      if (priorVars[slot] === next) { finalVariables[slot] = next; continue; }
      const dec = await policyChecker.validateSlotWrite({
        journeyId: journey.id, slotName: slot, value: next, variables: finalVariables,
      });
      const reason = dec.decision === "allow" ? undefined : (dec as { reason: string }).reason;
      await emitPolicy(ctx, `slot:${slot}`, { decision: dec.decision, reason });
      if (dec.decision === "deny") {
        if (priorVars[slot] !== undefined) finalVariables[slot] = priorVars[slot];
        continue;
      }
      finalVariables[slot] = next;
      const meta = slotMetadata.get(slot);
      await ctx.audit.emit("slot_write", {
        slot, value: next, journeyId: journey.id,
        source: meta?.source, profile: meta?.profile,
      });
    }
    result.state.variables = finalVariables;

    // Gate api_call actions through tool policy. Post-hoc — see file header
    // comment. The action is dropped from the response and a policy_event is
    // recorded, but legacy api node side effects (e.g. KYC mock setting
    // kyc_status into variables) fire before this point.
    const allowedActions: typeof result.actions = [];
    let pendingAction: SubAgentRunOutput["pendingAction"];
    let gateMessage: string | null = null;
    for (const action of result.actions) {
      if (action.type === "api_call") {
        const tool = String((action.payload as { endpoint?: string } | undefined)?.endpoint ?? "api_call");
        const dec = await policyChecker.validateToolCall({
          tool, params: (action.payload ?? {}) as Record<string, unknown>, variables: finalVariables,
        });
        const reason = dec.decision === "allow" ? undefined : (dec as { reason: string }).reason;
        await emitPolicy(ctx, `tool:${tool}`, { decision: dec.decision, reason });
        if (dec.decision === "deny") { gateMessage = `I can't perform that step: ${dec.reason}`; continue; }
        if (dec.decision === "require_approval") {
          pendingAction = { id: `pending-${Date.now()}`, tool, params: (action.payload ?? {}) as Record<string, unknown> };
          gateMessage = "This needs approval before I can proceed.";
          continue;
        }
      }
      allowedActions.push(action);
    }

    // Audit hybrid-specific action types. Skip set_variable / api_call —
    // workflow-agent self-audits those above (slot_write per accepted variable
    // + provenance, policy_event per gated api_call).
    await emitJourneyTransitions(ctx.audit, journey.id, oldHistory, result.state.history as JourneyHistoryEntry[]);
    await emitAuditFromActions(ctx.audit, result.actions, {
      journeyId: journey.id,
      skip: ["set_variable", "api_call"],
    });

    try {
      await dialogStateRepo.upsertByConversationForTenant(ctx.tenantId, ctx.conversationId, {
        journey_id: journey.id, current_node_id: result.state.currentNodeId,
        variables: result.state.variables, history: result.state.history,
        context: result.state.context, done: result.done ? 1 : 0,
      });
    } catch (err) {
      // Persistence failure is non-fatal for the turn (the response is still
      // returned), but it must be visible in logs and the audit trail.
      console.error("[workflowAgent] dialog state persistence failed:", err);
      await ctx.audit.emit("policy_event", {
        decision: "deny", target: "persistence",
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    let response = gateMessage ?? (result.messages.join("\n").trim() || "Let me start the workflow.");
    const rd = await policyChecker.validateResponse({ content: response, variables: finalVariables });
    const rdReason = rd.decision === "allow" ? undefined : (rd as { reason: string }).reason;
    await emitPolicy(ctx, "response", { decision: rd.decision, reason: rdReason });
    if (rd.decision === "deny") response = SAFE_FALLBACK;

    return {
      response, variables: finalVariables, done: result.done,
      actions: allowedActions.map((a) => ({ type: a.type, payload: (a.payload ?? {}) as Record<string, unknown> })),
      pendingAction,
    };
  },
};
