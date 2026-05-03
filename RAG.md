# RAG & Vector DB Architecture

## Where is the RAG database / Vector DB?

**Short answer: There isn't one yet.** The app uses keyword-based retrieval, not vector search.

---

## Current Architecture (Keyword-Based)

```
User Query
    │
    ▼
┌─────────────────┐
│  retrieveKnowledge()   │  ← src/lib/rag.ts
│  - Split into keywords │
│  - Match against DB    │
│  - Score by overlap    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Static KB (5 docs)    │
│  + DB sources table    │
└─────────────────┘
    │
    ▼
Ranked Top-K Results → Injected into LLM prompt
```

### How it works today
1. `retrieveKnowledge("return policy")` splits into `["return", "policy"]`
2. Matches against `knowledge_sources` (DB table) + hardcoded static articles
3. Scores by counting keyword overlaps
4. Returns top 3 documents sorted by score
5. Agent runtime injects these into the LLM system prompt as `[Knowledge: title] content`

### Limitations
- **No semantic understanding**: "I want my money back" won't match "Refund Policy"
- **O(n) scan**: Linear over all documents (fine for < 1000 docs)
- **No embeddings**: Can't capture conceptual similarity

---

## Future Architecture (Vector-Based)

```
User Query
    │
    ▼
┌─────────────────────────┐
│  Embedding Model         │  ← OpenAI text-embedding-3-small
│  "return policy" → [0.12, │     or Ollama nomic-embed-text
│  -0.05, 0.88, ...]       │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Vector Database         │  ← pgvector / Pinecone / Qdrant
│  Approximate Nearest     │
│  Neighbor (ANN) Search   │
└─────────────────────────┘
    │
    ▼
Top-K by Cosine Similarity → Injected into LLM prompt
```

### Option 1: pgvector (Recommended — same Postgres instance)

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_sources
ALTER TABLE knowledge_sources ADD COLUMN embedding vector(1536);

-- Create HNSW index for fast ANN search
CREATE INDEX idx_knowledge_embedding ON knowledge_sources
USING hnsw (embedding vector_cosine_ops);

-- Query
SELECT name, content, 1 - (embedding <=> $1) AS similarity
FROM knowledge_sources
WHERE status = 'active'
ORDER BY embedding <=> $1
LIMIT 3;
```

**Pros:** Same DB, no extra infra, ACID transactions  
**Cons:** Requires PostgreSQL (not SQLite), adds ~6MB per 1000 docs

### Option 2: Pinecone / Weaviate / Qdrant (External)

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("sierra-knowledge");

// Upsert
await index.upsert([{ id: "doc-1", values: embedding, metadata: { title, content } }]);

// Search
const results = await index.query({ vector: queryEmbedding, topK: 3 });
```

**Pros:** Managed, scales to billions of vectors  
**Cons:** Extra service, latency, cost

### Option 3: sqlite-vec (For SQLite fallback)

```sql
-- SQLite extension for vector search
.load vec0
CREATE VIRTUAL TABLE knowledge_embeddings USING vec0(embedding float[768]);

INSERT INTO knowledge_embeddings(rowid, embedding) VALUES (1, '[0.1, 0.2, ...]');

SELECT rowid, distance FROM knowledge_embeddings
WHERE embedding MATCH '[0.1, 0.2, ...]'
ORDER BY distance
LIMIT 3;
```

**Pros:** Works with existing SQLite setup  
**Cons:** Requires native extension, smaller community

---

## When to add Vector Search

| Scale | Recommendation |
|-------|---------------|
| < 500 docs | Keyword RAG is fine |
| 500 - 10K | Add pgvector |
| 10K - 1M | pgvector with HNSW + partitioning |
| > 1M | Dedicated vector DB (Pinecone/Qdrant) |

---

## Adding Vector Search to This App

1. **Install dependencies:**
   ```bash
   npm install openai  # for embeddings API
   # or use Ollama: npm install ollama
   ```

2. **Add embedding generation:**
   ```typescript
   // src/lib/embeddings.ts
   export async function embed(text: string): Promise<number[]> {
     // OpenAI
     const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
     const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
     return res.data[0].embedding;
   }
   ```

3. **Update schema:**
   ```sql
   ALTER TABLE knowledge_sources ADD COLUMN embedding vector(1536);
   CREATE INDEX idx_knowledge_embedding ON knowledge_sources USING hnsw (embedding vector_cosine_ops);
   ```

4. **Update retrieveKnowledge():**
   ```typescript
   export async function retrieveKnowledge(query: string, topK = 3) {
     if (isPostgres() && hasVectorColumn()) {
       const embedding = await embed(query);
       const result = await query(
         `SELECT name, content, 1 - (embedding <=> $1) AS similarity
          FROM knowledge_sources WHERE status = 'active'
          ORDER BY embedding <=> $1 LIMIT $2`,
         [JSON.stringify(embedding), topK]
       );
       return result.rows.map(r => ({ title: r.name, content: r.content, source: r.name, relevance: r.similarity }));
     }
     // fallback to keyword search
     return keywordSearch(query, topK);
   }
   ```
