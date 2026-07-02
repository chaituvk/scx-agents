import { query, isPostgres } from "./db";

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

// ── Embedding Generation ─────────────────────────────────────────────

/**
 * Generate a text embedding using OpenAI (primary) or Ollama (fallback).
 * Returns null if both providers are unavailable or fail.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = process.env.OPENAI_API_KEY;

  // Try OpenAI first
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.data?.[0]?.embedding ?? null;
      }
    } catch {
      // fall through to Ollama
    }
  }

  // Try Ollama as fallback
  try {
    const res = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.embedding ?? null;
    }
  } catch {
    // both providers failed
  }

  return null;
}

// ── Embedding Storage ────────────────────────────────────────────────

/**
 * Upsert a content chunk and its embedding into knowledge_embeddings.
 */
export async function storeEmbedding(
  tenantId: string,
  sourceId: string,
  content: string,
  embedding: number[],
): Promise<void> {
  // Stable ID: source + first 32 chars of content (hex-encoded via charCode)
  const prefix = content.slice(0, 32).split("").map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const id = `emb-${sourceId}-${prefix}`;
  const vectorLiteral = `[${embedding.join(",")}]`;
  await query(
    `INSERT INTO knowledge_embeddings (id, tenant_id, source_id, content, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)
     ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
    [id, tenantId, sourceId, content, vectorLiteral],
  );
}

// ── Vector Search ────────────────────────────────────────────────────

/**
 * Search knowledge_embeddings using cosine similarity via pgvector.
 * Returns [] when running on SQLite (no pgvector) or when embedding fails.
 */
export async function vectorSearch(
  queryText: string,
  tenantId: string,
  topK: number,
): Promise<KnowledgeDoc[]> {
  if (!isPostgres()) return [];

  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const vectorLiteral = `[${embedding.join(",")}]`;

  try {
    const result = await query(
      `SELECT ke.source_id, ke.content, ks.name as title,
              1 - (ke.embedding <=> $1::vector) AS similarity
       FROM knowledge_embeddings ke
       JOIN knowledge_sources ks ON ke.source_id = ks.id
       WHERE ke.tenant_id = $2
       ORDER BY ke.embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral, tenantId, topK],
    );

    return result.rows.map((row) => ({
      title: row.title,
      content: row.content,
      source: row.title,
      relevance: parseFloat(row.similarity) || 0,
    }));
  } catch {
    return [];
  }
}

// ── Knowledge Indexing ───────────────────────────────────────────────

/**
 * Chunk content into 500-char segments, embed each chunk, and store in
 * knowledge_embeddings. Only meaningful on Postgres (pgvector).
 */
export async function indexKnowledgeSource(
  tenantId: string,
  sourceId: string,
  content: string,
): Promise<void> {
  if (!isPostgres()) return;

  const CHUNK_SIZE = 500;
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    if (embedding) {
      await storeEmbedding(tenantId, sourceId, chunk, embedding);
    }
  }
}

// ── Vector Search Availability ───────────────────────────────────────

/**
 * Returns true if a vector search provider is configured.
 * Checks env vars only — no network calls.
 */
export function hasVectorSearch(): boolean {
  if (process.env.OPENAI_API_KEY) return true;
  // Ollama has no key, but we consider it available when explicitly opted-in
  if (process.env.OLLAMA_ENABLED === "true") return true;
  return false;
}

/**
 * Retrieve relevant knowledge documents for a user query.
 *
 * ARCHITECTURE:
 * ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │  User Query     │────▶│  Vector Search  │────▶│  Rank & Return  │
 * │  "return policy"│     │  (pgvector)     │     │  Top-K docs     │
 * └─────────────────┘     └────────┬────────┘     └─────────────────┘
 *                                  │ fallback
 *                         ┌────────▼────────┐
 *                         │ Keyword Match   │
 *                         │ (always runs)   │
 *                         └─────────────────┘
 *
 * VECTOR PATH (when hasVectorSearch() && isPostgres()):
 * - Convert query to embedding via OpenAI/Ollama
 * - Cosine similarity search via pgvector HNSW index
 * - Merge + deduplicate with keyword results, rank by relevance
 *
 * KEYWORD PATH (fallback / always merged):
 * - Splits query into keywords
 * - Matches against knowledge_sources table + static KB
 * - Scores by keyword overlap count
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
  const keywordResults: KnowledgeDoc[] = [];

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
        keywordResults.push({
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
      keywordResults.push({ ...doc, relevance: score });
    }
  }

  // ── Layer 3: Semantic fallback (exact phrase match) ─────────────────
  // Fuzzy substring search on this tenant's static KB only — no cross-
  // tenant leakage on the fallback path either.
  if (keywordResults.length === 0) {
    const queryLower = userQuery.toLowerCase();
    for (const doc of tenantStatic) {
      if (doc.title.toLowerCase().includes(queryLower) || doc.content.toLowerCase().includes(queryLower)) {
        keywordResults.push({ ...doc, relevance: 1 });
      }
    }
  }

  // ── Layer 4: Vector search (Postgres + configured provider) ─────────
  if (hasVectorSearch() && isPostgres()) {
    const vectorResults = await vectorSearch(userQuery, tenantId, topK);

    if (vectorResults.length >= 1) {
      // Merge: vector results take precedence; deduplicate by title
      const seen = new Set<string>();
      const merged: KnowledgeDoc[] = [];

      for (const doc of vectorResults) {
        if (!seen.has(doc.title)) {
          seen.add(doc.title);
          merged.push(doc);
        }
      }
      for (const doc of keywordResults) {
        if (!seen.has(doc.title)) {
          seen.add(doc.title);
          merged.push(doc);
        }
      }

      return merged
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, topK);
    }
    // Vector search returned 0 results — fall through to keyword only
  }

  return keywordResults
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, topK);
}
