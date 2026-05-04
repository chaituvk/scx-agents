// RespondSkill — generates a grounded reply using context, history, and passages.

import { callModel } from "../model-router";
import type {
  Skill,
  SkillContext,
  RespondInput,
  RespondOutput,
} from "../agents/types";

function buildHistory(history: RespondInput["history"]): string {
  return history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");
}

function extractCitations(text: string): string[] {
  const out = new Set<string>();
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1].trim());
  return Array.from(out);
}

export const respondSkill: Skill<RespondInput, RespondOutput> = {
  name: "respond",
  async run(input: RespondInput, _ctx: SkillContext): Promise<RespondOutput> {
    const passagesBlock =
      input.passages && input.passages.length > 0
        ? `RELEVANT KNOWLEDGE (ground your answer in these and cite sources inline as [source]):\n${input.passages
            .map((p) => `[${p.source}] ${p.title}: ${p.content}`)
            .join("\n")}\n\n`
        : "";

    const varsBlock =
      input.variables && Object.keys(input.variables).length > 0
        ? `KNOWN VARIABLES:\n${Object.entries(input.variables)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n")}\n\n`
        : "";

    const historyBlock = `CONVERSATION HISTORY:\n${buildHistory(input.history)}\n\n`;
    const userPrompt = `${passagesBlock}${varsBlock}${historyBlock}Customer: ${input.userMessage}\n\nAgent:`;

    const res = await callModel(
      [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { tier: "reasoning" }
    );
    const content = (res.content ?? "").trim();
    const citations = input.passages && input.passages.length > 0 ? extractCitations(content) : [];
    return { content, citations };
  },
};
