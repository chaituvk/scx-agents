// SummarizeSkill — compresses conversation history to a short summary.

import { callModel } from "../model-router";
import type {
  Skill,
  SkillContext,
  SummarizeInput,
  SummarizeOutput,
} from "../agents/types";

export const summarizeSkill: Skill<SummarizeInput, SummarizeOutput> = {
  name: "summarize",
  async run(input: SummarizeInput, _ctx: SkillContext): Promise<SummarizeOutput> {
    const maxWords = input.maxTokens ?? 200;
    const transcript = input.history
      .map((m) => `${m.role === "user" ? "Customer" : m.role === "assistant" ? "Agent" : "System"}: ${m.content}`)
      .join("\n");
    const sys = `You compress customer-support transcripts. Produce a concise summary (~${maxWords} words max) covering: customer goal, key facts/slots, tools used, current status. No preamble.`;
    const res = await callModel(
      [
        { role: "system", content: sys },
        { role: "user", content: transcript || "(empty transcript)" },
      ],
      { tier: "small" }
    );
    return { summary: (res.content ?? "").trim() };
  },
};
