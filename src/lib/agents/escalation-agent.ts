// EscalationAgent — human handoff sub-agent.

import { summarizeSkill } from "../skills";
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
} from "./types";

export const escalationAgent: SubAgent = {
  name: "escalation",

  canHandle(triage: TriageOutput): boolean {
    return triage.subAgent === "escalation";
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const { summary } = await summarizeSkill.run(
      { history: input.context.history },
      ctx
    );

    const response = `I'll transfer you to a human agent. Here's what I've shared with them: ${summary}`;

    const transferAction = {
      type: "transfer",
      payload: { summary, reason: input.triage.intent },
    };

    await ctx.audit.emit("journey_transition", {
      type: "escalation",
      reason: input.triage.intent,
      summary,
    });

    return {
      response,
      variables: input.variables,
      done: true,
      actions: [transferAction],
    };
  },
};
