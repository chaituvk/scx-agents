// RetrieveSkill — wraps RAG knowledge retrieval and shapes passages.

import { retrieveKnowledge } from "../rag";
import type {
  Skill,
  SkillContext,
  RetrieveInput,
  RetrieveOutput,
  RetrievePassage,
} from "../agents/types";

export const retrieveSkill: Skill<RetrieveInput, RetrieveOutput> = {
  name: "retrieve",
  async run(input: RetrieveInput, ctx: SkillContext): Promise<RetrieveOutput> {
    const topK = input.topK ?? 3;
    const docs = await retrieveKnowledge(input.query, topK, ctx.tenantId);
    const passages: RetrievePassage[] = docs.map((d) => ({
      source: d.source,
      title: d.title,
      content: d.content,
      score: d.relevance,
    }));
    return { passages };
  },
};
