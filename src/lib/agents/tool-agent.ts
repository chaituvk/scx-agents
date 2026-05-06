// ToolAgent — one-shot tool invocation sub-agent.

import { extractSlotSkill, actSkill, respondSkill } from "../skills";
import { policyChecker } from "../policy";
import {
  loadSpecialistProfile,
  applyGuardrailsToSystemPrompt,
  auditProfileBinding,
  isToolAllowedByProfile,
} from "./profile-binding";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
  ExtractSlotInput,
} from "./types";

interface ToolPlan {
  tool: string;
  schema: ExtractSlotInput["slotSchema"];
}

function planTool(message: string): ToolPlan {
  const lower = message.toLowerCase();
  if (lower.includes("order")) {
    return {
      tool: "order_lookup",
      schema: { order_number: { type: "string", description: "Order or ticket number" } },
    };
  }
  if (lower.includes("promo") || lower.includes("coupon") || lower.includes("code")) {
    return {
      tool: "apply_promo_code",
      schema: { code: { type: "string", description: "Promo or coupon code" } },
    };
  }
  return {
    tool: "search_knowledge",
    schema: { query: { type: "string", description: "Knowledge search query" } },
  };
}

const SUMMARIZE_SYSTEM =
  "You are a customer support assistant. Summarize the tool result for the customer in 1-2 sentences. Do not invent details beyond the result.";

export const toolAgent: SubAgent = {
  name: "tool",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "tool";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    // Stage 14: bind to a runtime specialist profile when one is
    // available. allowed_tools (if any) is enforced before slot
    // extraction so we don't even ask the LLM to extract for a
    // disallowed tool. Guardrails reach the summarize prompt below.
    const profile = await loadSpecialistProfile(ctx.tenantId, input.triage.specialistId);
    await auditProfileBinding(ctx.audit, "tool", profile, input.triage.specialistId);

    const plan = planTool(input.message);

    if (!isToolAllowedByProfile(profile, plan.tool)) {
      const profileName = profile?.name ?? "unknown";
      await ctx.audit.emit("policy_event", {
        decision: "deny",
        reason: `Tool '${plan.tool}' not in allowed_tools for profile '${profileName}'`,
        target: `tool:${plan.tool}`,
        profile: profileName,
      });
      return {
        response: "I can't run that for you — the active runtime profile doesn't permit this tool.",
        variables: input.variables,
        done: true,
        actions: [],
      };
    }

    const extracted = await extractSlotSkill.run(
      { message: input.message, slotSchema: plan.schema },
      ctx
    );
    // Default fallback: pass message as `query` if nothing extracted and tool is search_knowledge.
    const params: Record<string, unknown> = { ...extracted.slots };
    if (plan.tool === "search_knowledge" && !params.query) {
      params.query = input.message;
    }

    const decision = await policyChecker.validateToolCall({
      tool: plan.tool,
      params,
      variables: input.variables,
    });
    await ctx.audit.emit("policy_event", {
      decision: decision.decision,
      reason: decision.decision === "allow" ? undefined : (decision as { reason: string }).reason,
      target: `tool:${plan.tool}`,
    });

    if (decision.decision === "deny") {
      return {
        response: `I can't run that for you: ${decision.reason}`,
        variables: input.variables,
        done: true,
        actions: [],
      };
    }

    if (decision.decision === "require_approval") {
      return {
        response: "This needs approval before I can proceed.",
        variables: input.variables,
        done: false,
        actions: [],
        pendingAction: { id: `pending-${Date.now()}`, tool: plan.tool, params },
      };
    }

    const actResult = await actSkill.run({ tool: plan.tool, params }, ctx);

    const summarySystemPrompt = applyGuardrailsToSystemPrompt(SUMMARIZE_SYSTEM, profile);
    const summary = await respondSkill.run(
      {
        systemPrompt: summarySystemPrompt,
        userMessage: input.message,
        history: input.context.history,
        variables: {
          ...input.variables,
          tool_name: plan.tool,
          tool_result: JSON.stringify(actResult.result),
          tool_ok: String(actResult.ok),
        },
      },
      ctx
    );

    let content = summary.content || "Done.";
    const respDecision = await policyChecker.validateResponse({
      content,
      variables: input.variables,
    });
    await ctx.audit.emit("policy_event", {
      decision: respDecision.decision,
      reason: respDecision.decision === "allow" ? undefined : (respDecision as { reason: string }).reason,
      target: "response",
    });
    if (respDecision.decision === "deny") {
      content = "I'm not able to share that information.";
    }

    return {
      response: content,
      variables: input.variables,
      toolCalls: [{ tool: plan.tool, params, result: actResult.result }],
      done: true,
      actions: [],
    };
  },
};
