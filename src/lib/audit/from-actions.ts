import type { AuditEmitter } from "@/lib/agents/types";

// Translates an executor's in-band action stream into audit_events rows so
// every orchestration path writes through the same telemetry surface.
//
// EVENT PAYLOAD SHAPES — normalized to match what the existing orchestrator
// sub-agents (workflow-agent, rag-agent, tool-agent) already emit, so a single
// listByConversation consumer renders both origins consistently:
//
//   policy_event       → { decision, reason?, target, effect?, allowed?, policyId?, tool?, profile?, journeyId? }
//   slot_write         → { slot, value, source?, profile?, journeyId? }
//   tool_call          → { tool, params?, result?, profile?, journeyId? }
//   escalation_handoff → { reason?, department?, journeyId? }
//   journey_transition → { journeyId, nodeId, ts }
//
// IDEMPOTENCE: emit() inserts a fresh row per call. Client retries will produce
// duplicate events. Consumers that need exact-once should dedupe by
// (conversationId, type, payload.nodeId, payload.ts) for transitions or
// (conversationId, type, payload.tool, ts) for tool calls.
//
// CALLER CONTRACT: only invoke from a code path that OWNS an executor's
// returned actions. Sub-agents that already self-audit (e.g. workflow-agent
// emits policy_event/slot_write internally before returning) must NOT be
// re-piped through this helper or rows will duplicate.

export interface ExecutorAction {
  type: string;
  payload?: Record<string, unknown>;
}

export interface JourneyHistoryEntry {
  nodeId: string;
  timestamp: string;
}

export async function emitAuditFromActions(
  audit: AuditEmitter,
  actions: ExecutorAction[] | undefined | null,
  context: { journeyId?: string; skip?: string[] } = {},
): Promise<void> {
  if (!actions?.length) return;
  const skip = context.skip ? new Set(context.skip) : null;
  for (const action of actions) {
    if (skip?.has(action.type)) continue;
    const orig = action.payload ?? {};
    const journeyId = (orig.journeyId as string | undefined) ?? context.journeyId;

    switch (action.type) {
      case "policy_decision": {
        const tool = orig.tool as string | undefined;
        const profile = orig.profile as string | undefined;
        const target = tool ? `tool:${tool}` : profile ? `profile:${profile}` : "policy";
        await audit.emit("policy_event", {
          decision: orig.effect ?? (orig.allowed ? "allow" : "deny"),
          reason: orig.reason,
          target,
          effect: orig.effect,
          allowed: orig.allowed,
          policyId: orig.policyId,
          tool: orig.tool,
          profile: orig.profile,
          journeyId,
        });
        break;
      }

      case "tool_result":
      case "api_call": {
        const tool = (orig.tool as string | undefined) ?? (orig.endpoint as string | undefined);
        await audit.emit("tool_call", {
          tool,
          params: orig.params,
          result: orig.result,
          profile: orig.profile,
          journeyId,
        });
        break;
      }

      case "transfer": {
        await audit.emit("escalation_handoff", {
          reason: orig.reason,
          department: orig.department,
          journeyId,
        });
        break;
      }

      case "set_variable": {
        await audit.emit("slot_write", {
          slot: orig.variable ?? orig.slot,
          value: orig.value,
          source: orig.source,
          profile: orig.profile,
          journeyId,
        });
        break;
      }

      // wait_input is a control signal — not auditable
      default:
        break;
    }
  }
}

export async function emitJourneyTransitions(
  audit: AuditEmitter,
  journeyId: string,
  oldHistory: JourneyHistoryEntry[] | undefined | null,
  newHistory: JourneyHistoryEntry[] | undefined | null,
): Promise<void> {
  if (!newHistory?.length) return;
  const startIdx = oldHistory?.length ?? 0;
  for (let i = startIdx; i < newHistory.length; i++) {
    const entry = newHistory[i];
    await audit.emit("journey_transition", {
      journeyId,
      nodeId: entry.nodeId,
      ts: entry.timestamp,
    });
  }
}
