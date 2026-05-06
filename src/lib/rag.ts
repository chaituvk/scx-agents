import { query } from "./db";

export interface KnowledgeDoc {
  title: string;
  content: string;
  source: string;
  relevance: number;
}

// Static KB articles — dev fixtures, scoped per tenant.
//
// Stage 8 (tenant-scoped RAG): the previous global STATIC_KB array was
// returned for every tenant, which leaked one tenant's policy/KYC/sales
// content into other tenants' retrievals. Static fixtures now live under
// the tenant they were authored for. Tenants without an entry get [] —
// they retrieve only from knowledge_sources rows that belong to them.
const STATIC_KB_BY_TENANT: Record<string, KnowledgeDoc[]> = {
  "r-mobile": [
    { title: "Return Policy", content: "Items can be returned within 30 days for full refund. Defective items get free replacement + prepaid label. Changed mind: store credit (10% bonus) or refund minus $5 restocking.", source: "Help Center", relevance: 0 },
    { title: "Shipping Policy", content: "Standard shipping: 3-5 business days. Express: 1-2 days ($9.99). International: 7-14 days ($15 surcharge).", source: "Help Center", relevance: 0 },
    { title: "Warranty", content: "Electronics: 1-year manufacturer warranty + 90-day return. Clothing: 30-day return. Food items: non-returnable.", source: "Help Center", relevance: 0 },
    { title: "Promo Code Rules", content: "Only one promo code per order. Cannot be combined with other offers. Stackable with loyalty points.", source: "Help Center", relevance: 0 },
    { title: "Refund Timeline", content: "Refunds process within 3-5 business days. Store credit is instant. Replacement ships within 24 hours.", source: "Help Center", relevance: 0 },
    { title: "KYC Verification", content: "Identity verification requires last 4 digits of SSN and date of birth. Risk scores: Low (0-30), Medium (31-70), High (71-100). High risk requires manual review.", source: "Compliance", relevance: 0 },
    { title: "Sales Upsell Policy", content: "Sales agents must disclose all terms before promoting offers. Never make false claims. Respect opt-out preferences. Maximum discount without approval: 25%.", source: "Sales Playbook", relevance: 0 },
  ],
};

/**
 * Retrieve relevant knowledge documents for a user query.
 *
 * ARCHITECTURE:
 * ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │  User Query     │────▶│  Keyword Match  │────▶│  Rank & Return  │
 * │  "return policy"│     │  (current)      │     │  Top-K docs     │
 * └─────────────────┘     └─────────────────┘     └─────────────────┘
 *
 * CURRENT (keyword-based):
 * - Splits query into keywords
 * - Matches against knowledge_sources table + static KB
 * - Scores by keyword overlap count
 * - O(n) where n = total documents
 *
 * FUTURE (vector-based):
 * - Convert query to embedding via OpenAI/Ollama
 * - Search vector DB (pgvector / Pinecone / Qdrant)
 * - Cosine similarity ranking
 * - O(log n) with HNSW index
 */
export async function retrieveKnowledge(
  userQuery: string,
  topK: number = 3,
  tenantId: string,
): Promise<KnowledgeDoc[]> {
  if (!tenantId) {
    // Required parameter — refuse rather than silently fall back to a
    // global retrieve, which is exactly the leak Stage 8 fixed.
    throw new Error("retrieveKnowledge requires tenantId");
  }
  const keywords = userQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const results: KnowledgeDoc[] = [];

  // ── Layer 1: Dynamic knowledge_sources, scoped to tenant ────────────
  try {
    const dbResult = await query(
      "SELECT * FROM knowledge_sources WHERE tenant_id = $1 AND status = 'active'",
      [tenantId],
    );
    for (const source of dbResult.rows) {
      const text = `${source.name || ""} ${source.type || ""}`.toLowerCase();
      const score = keywords.filter((k) => text.includes(k)).length;
      if (score > 0) {
        results.push({
          title: source.name,
          content: `${source.name} — ${source.entries} entries. Last synced: ${source.last_sync || "unknown"}.`,
          source: source.name,
          relevance: score,
        });
      }
    }
  } catch {
    // DB unavailable — fall back to per-tenant static KB only.
  }

  // ── Layer 2: Static KB articles, scoped to tenant ───────────────────
  const tenantStatic = STATIC_KB_BY_TENANT[tenantId] ?? [];
  for (const doc of tenantStatic) {
    const text = `${doc.title} ${doc.content}`.toLowerCase();
    const score = keywords.filter((k) => text.includes(k)).length;
    if (score > 0) {
      results.push({ ...doc, relevance: score });
    }
  }

  // ── Layer 3: Semantic fallback (exact phrase match) ─────────────────
  // Fuzzy substring search on this tenant's static KB only — no cross-
  // tenant leakage on the fallback path either.
  if (results.length === 0) {
    const queryLower = userQuery.toLowerCase();
    for (const doc of tenantStatic) {
      if (doc.title.toLowerCase().includes(queryLower) || doc.content.toLowerCase().includes(queryLower)) {
        results.push({ ...doc, relevance: 1 });
      }
    }
  }

  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, topK);
}

/**
 * Check if the RAG system has any vector search capability.
 * Returns false until a vector DB is wired in.
 */
export function hasVectorSearch(): boolean {
  return false;
}

/**
 * Future: vector search using pgvector, Pinecone, Qdrant, etc.
 *
 * Example with pgvector (PostgreSQL):
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE knowledge_embeddings (
 *     id TEXT PRIMARY KEY,
 *     source_id TEXT REFERENCES knowledge_sources(id),
 *     content TEXT NOT NULL,
 *     embedding vector(1536),  -- OpenAI text-embedding-3-small
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops);
 *
 *   SELECT source_id, content, 1 - (embedding <=> query_embedding) AS similarity
 *   FROM knowledge_embeddings
 *   ORDER BY embedding <=> query_embedding
 *   LIMIT 3;
 */
