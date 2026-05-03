// WorkflowAgent — multi-step procedure sub-agent driven by DialogEngine.

import { DialogEngine } from "../dialog/engine";
import type { Journey as DialogJourney, DialogState as EngineState } from "../dialog/types";
import { journeyRepo, dialogStateRepo } from "../repositories";
import { policyChecker } from "../policy";
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
  created_at?: string; updated_at?: string;
};

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

async function resolveJourney(triage: TriageOutput): Promise<DialogJourney | null> {
  if (triage.journeyId) {
    const j = await journeyRepo.findById(triage.journeyId);
    if (j) return toDialogJourney(j as RawJourney);
  }
  const all = await journeyRepo.findAll();
  const active = all.find((j) => j.status === "active") ?? all[0];
  return active ? toDialogJourney(active as RawJourney) : null;
}

async function emitPolicy(ctx: SkillContext, target: string, d: { decision: string; reason?: string }) {
  await ctx.audit.emit("policy_event", { decision: d.decision, reason: d.reason, target });
}

export const workflowAgent: SubAgent = {
  name: "workflow",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "workflow";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const journey = await resolveJourney(input.triage);
    if (!journey) {
      return { response: NO_WORKFLOW, variables: input.variables, done: true, actions: [] };
    }

    const persisted = await dialogStateRepo.findByConversation(ctx.conversationId);
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

    const engine = new DialogEngine(journey);
    const result = state.currentNodeId
      ? engine.handleInput(state, input.message)
      : engine.start(state);

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
      await ctx.audit.emit("slot_write", { slot, value: next, journeyId: journey.id });
    }
    result.state.variables = finalVariables;

    // Gate api_call actions through tool policy.
    const allowedActions: typeof result.actions = [];
    let pendingAction: SubAgentRunOutput["pendingAction"];
    let gateMessage: string | null = null;
    for (const action of result.actions) {
      if (action.type === "api_call") {
        const tool = String((action.payload as { endpoint?: string }).endpoint ?? "api_call");
        const dec = await policyChecker.validateToolCall({
          tool, params: action.payload, variables: finalVariables,
        });
        const reason = dec.decision === "allow" ? undefined : (dec as { reason: string }).reason;
        await emitPolicy(ctx, `tool:${tool}`, { decision: dec.decision, reason });
        if (dec.decision === "deny") { gateMessage = `I can't perform that step: ${dec.reason}`; continue; }
        if (dec.decision === "require_approval") {
          pendingAction = { id: `pending-${Date.now()}`, tool, params: action.payload as Record<string, unknown> };
          gateMessage = "This needs approval before I can proceed.";
          continue;
        }
      }
      allowedActions.push(action);
    }

    try {
      await dialogStateRepo.upsertByConversation(ctx.conversationId, {
        journey_id: journey.id, current_node_id: result.state.currentNodeId,
        variables: result.state.variables, history: result.state.history,
        context: result.state.context, done: result.done ? 1 : 0,
      });
    } catch {
      // v1 limitation: dialog state persistence best-effort.
    }

    let response = gateMessage ?? (result.messages.join("\n").trim() || "Let me start the workflow.");
    const rd = await policyChecker.validateResponse({ content: response, variables: finalVariables });
    const rdReason = rd.decision === "allow" ? undefined : (rd as { reason: string }).reason;
    await emitPolicy(ctx, "response", { decision: rd.decision, reason: rdReason });
    if (rd.decision === "deny") response = SAFE_FALLBACK;

    return {
      response, variables: finalVariables, done: result.done,
      actions: allowedActions.map((a) => ({ type: a.type, payload: a.payload })),
      pendingAction,
    };
  },
};
