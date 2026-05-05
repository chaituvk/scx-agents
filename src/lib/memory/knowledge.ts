// L4 knowledge memory — RAG passage retrieval, tenant-scoped.

import { retrieveKnowledge } from "../rag";
import type { RetrievePassage } from "../agents/types";

export async function loadKnowledge(
  query: string,
  tenantId: string,
  topK: number = 3,
): Promise<RetrievePassage[]> {
  if (!query || !query.trim()) return [];
  const docs = await retrieveKnowledge(query, topK, tenantId);
  return docs.map((d) => ({
    source: d.source,
    title: d.title,
    content: d.content,
    score: d.relevance,
  }));
}
