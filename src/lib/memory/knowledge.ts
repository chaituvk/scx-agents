// L4 knowledge memory — RAG passage retrieval.

import { retrieveKnowledge } from "../rag";
import type { RetrievePassage } from "../agents/types";

export async function loadKnowledge(
  query: string,
  topK: number = 3,
): Promise<RetrievePassage[]> {
  if (!query || !query.trim()) return [];
  const docs = await retrieveKnowledge(query, topK);
  return docs.map((d) => ({
    source: d.source,
    title: d.title,
    content: d.content,
    score: d.relevance,
  }));
}
