-- Auto-runs when the pgvector container starts for the first time
CREATE EXTENSION IF NOT EXISTS vector;

-- Optional: Create a dedicated table for knowledge embeddings
-- This will be used when you migrate from keyword RAG to vector RAG
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
ON knowledge_embeddings
USING hnsw (embedding vector_cosine_ops);
