// EscalationAgent — human handoff sub-agent.
//
// Stage 9: builds a rich HandoffContext on transfer instead of a
// `{ summary, reason }` stub. The context bundles identity, the
// summary, the last few transcript turns, session state (active
// journey + node + slots + topic stack + pending approval), and the
// most recent risk-relevant audit events. It is:
//   - persisted to dialog_states.handoff_state (already a registered
//     JSON_FIELD; populated for the first time by this stage)
//   - emitted as the escalation_handoff audit payload
//   - returned as the transfer action's payload so downstream
//     integrations (dashboards, paging, Slack) can pick it up.

import { summarizeSkill } from "../skills";
import { dialogStateRepo } from "../repositories";
import { auditStore } from "../audit";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
  HandoffContext,
  PendingApproval,
  TopicFrame,
} from "./types";

const RECENT_TRANSCRIPT_TURNS = 6;
const RECENT_POLICY_EVENT_LIMIT = 8;

export const escalationAgent: SubAgent = {
  name: "escalation",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "escalation";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const [{ summary }, dialogState, auditEvents] = await Promise.all([
      summarizeSkill.run({ history: input.context.history }, ctx),
      dialogStateRepo.findByConversationForTenant(ctx.conversationId, ctx.tenantId),
      auditStore.listByConversation(ctx.conversationId).catch(() => []),
    ]);

    const recentPolicyEvents = auditEvents
      .filter((e) => e.type === "policy_event")
      .slice(-RECENT_POLICY_EVENT_LIMIT)
      .map((e) => {
        const p = e.payload as { decision?: string; target?: string; reason?: string };
        return {
          ts: e.ts,
          decision: p.decision ?? "unknown",
          target: p.target,
          reason: p.reason,
        };
      });

    const recentTranscript = input.context.history
      .slice(-RECENT_TRANSCRIPT_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));

    const handoff: HandoffContext = {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      customerId: input.context.profile?.id,
      customerProfile: input.context.profile,
      reason: input.triage.intent,
      triggeringMessage: input.message,
      summary,
      recentTranscript,
      activeJourneyId: dialogState?.journey_id ?? undefined,
      currentNodeId: dialogState?.current_node_id ?? undefined,
      variables: { ...input.variables, ...((dialogState?.variables as Record<string, string> | undefined) ?? {}) },
      topicStack: Array.isArray(dialogState?.topic_stack)
        ? (dialogState!.topic_stack as TopicFrame[])
        : [],
      pendingApproval: dialogState?.pending_approval
        ? (dialogState.pending_approval as unknown as PendingApproval)
        : undefined,
      recentPolicyEvents,
      createdAt: new Date().toISOString(),
    };

    // Persist so a live-chat dashboard can pick up the context after the
    // turn (e.g. on conversation.status === "escalated" notification).
    // Best-effort: persistence failure must not block the handoff itself.
    try {
      await dialogStateRepo.upsertByConversationForTenant(ctx.tenantId, ctx.conversationId, {
        handoff_state: handoff as unknown as Record<string, unknown>,
      });
    } catch (err) {
      await ctx.audit.emit("policy_event", {
        decision: "deny", target: "handoff_persistence",
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    await ctx.audit.emit("escalation_handoff", handoff as unknown as Record<string, unknown>);

    const response = `I'll transfer you to a human agent. Here's what I've shared with them: ${summary}`;

    return {
      response,
      variables: input.variables,
      done: true,
      actions: [{ type: "transfer", payload: handoff as unknown as Record<string, unknown> }],
    };
  },
};
