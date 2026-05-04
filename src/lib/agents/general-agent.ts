// GeneralAgent — free-form conversational sub-agent.
//
// Handles smalltalk, greetings, acknowledgments, clarifying chatter, and
// open-ended questions that aren't grounded knowledge queries (rag), don't
// drive a workflow, and don't need a tool. No retrieval, no tools, no
// state mutation — just a guarded LLM reply.
//
// The policy checker still runs on the response so tone/PII/off-topic
// rules apply uniformly with the other sub-agents.

import { respondSkill } from "../skills";
import { policyChecker } from "../policy";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
  RespondOutput,
} from "./types";

const GENERAL_SYSTEM_PROMPT =
  "You are a friendly customer support assistant. Reply naturally to greetings, " +
  "small talk, and open-ended questions. Keep replies short (1-2 sentences). " +
  "Do not invent product details, policies, or account information — if the " +
  "user asks something specific that needs a knowledge base or account lookup, " +
  "say you'll check and offer to help with returns, orders, or questions about " +
  "policies.";

const SAFE_FALLBACK = "I'm here to help — could you tell me a bit more about what you need?";

export const generalAgent: SubAgent = {
  name: "general",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "general";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const responded: RespondOutput = await respondSkill.run(
      {
        systemPrompt: GENERAL_SYSTEM_PROMPT,
        userMessage: input.message,
        history: input.context.history,
        variables: input.variables,
      },
      ctx
    );

    let content = responded.content || SAFE_FALLBACK;

    const decision = await policyChecker.validateResponse({
      content,
      citations: [],
      variables: input.variables,
    });

    await ctx.audit.emit("policy_event", {
      decision: decision.decision,
      reason: decision.decision === "allow" ? undefined : (decision as { reason: string }).reason,
      target: "response",
    });

    if (decision.decision === "deny") {
      content = SAFE_FALLBACK;
    } else if (decision.decision === "require_approval") {
      content = `${content}\n\n(Note: this response is pending review.)`;
    }

    return {
      response: content,
      variables: input.variables,
      citations: [],
      done: false,
      actions: [],
    };
  },
};
