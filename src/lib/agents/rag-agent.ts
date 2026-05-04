// RAGAgent — knowledge Q&A sub-agent.

import { retrieveSkill, respondSkill } from "../skills";
import { policyChecker } from "../policy";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
  RetrieveOutput,
  RespondOutput,
} from "./types";

const RAG_SYSTEM_PROMPT =
  "You answer using only the provided knowledge passages. If the answer isn't in them, say so. Cite sources inline as [source]. Keep replies concise (2-3 sentences).";

const SAFE_FALLBACK = "I'm not able to share that information.";

export const ragAgent: SubAgent = {
  name: "rag",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "rag";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const retrieved: RetrieveOutput = await retrieveSkill.run(
      { query: input.message, topK: 3 },
      ctx
    );

    const responded: RespondOutput = await respondSkill.run(
      {
        systemPrompt: RAG_SYSTEM_PROMPT,
        userMessage: input.message,
        history: input.context.history,
        passages: retrieved.passages,
        variables: input.variables,
      },
      ctx
    );

    let content = responded.content || SAFE_FALLBACK;
    const citations = responded.citations ?? [];

    const decision = await policyChecker.validateResponse({
      content,
      citations,
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
      citations,
      done: false,
      actions: [],
    };
  },
};
