-- ════════════════════════════════════════════════════════════════════
--  Sierra — initial schema
--  Idempotent. Apply with the Supabase CLI (`supabase db push`), the SQL
--  editor, or psql. Mirrors src/lib/db.ts initPgSchema(), but orders the
--  pgvector extension BEFORE the table that uses the `vector` type.
-- ════════════════════════════════════════════════════════════════════

-- pgvector must exist before knowledge_embeddings references vector(1536).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  primary_color TEXT DEFAULT '#c4a574',
  accent_color TEXT DEFAULT '#0a0a0a',
  welcome_message TEXT,
  tone TEXT DEFAULT 'empathetic',
  off_limit_topics JSONB,
  off_limit_phrases JSONB,
  approval_threshold INTEGER DEFAULT 500,
  require_approval INTEGER DEFAULT 1,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  goals JSONB,
  skills JSONB,
  guardrails JSONB,
  languages JSONB,
  channels JSONB,
  tone TEXT DEFAULT 'empathetic',
  welcome_message TEXT,
  primary_color TEXT DEFAULT '#c4a574',
  accent_color TEXT DEFAULT '#0a0a0a',
  off_limit_topics JSONB,
  off_limit_phrases JSONB,
  approval_threshold INTEGER DEFAULT 500,
  require_approval INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version TEXT DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  channel TEXT DEFAULT 'web',
  status TEXT DEFAULT 'open',
  sentiment TEXT DEFAULT 'neutral',
  agent_id TEXT,
  assigned_to TEXT,
  topic TEXT,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_id TEXT,
  intent TEXT,
  groundings JSONB,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected',
  config JSONB,
  records TEXT,
  last_sync TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'specialist',
  status TEXT DEFAULT 'active',
  description TEXT,
  allowed_journeys JSONB,
  allowed_tools JSONB,
  allowed_slots JSONB,
  guardrails JSONB,
  policies JSONB,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flagged_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL,
  edges JSONB,
  variables JSONB,
  execution_mode TEXT DEFAULT 'deterministic',
  status TEXT DEFAULT 'draft',
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialog_states (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL,
  current_node_id TEXT,
  variables JSONB,
  history JSONB,
  context JSONB,
  done INTEGER DEFAULT 0,
  active_agent TEXT,
  last_intent TEXT,
  pending_action JSONB,
  pending_approval JSONB,
  topic_stack JSONB,
  handoff_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  entries INTEGER DEFAULT 0,
  url TEXT,
  last_sync TEXT,
  gaps JSONB,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  suggested_answer TEXT,
  source_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regression_tests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pass',
  last_run TEXT,
  duration TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_sims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  noise_level TEXT,
  speaker_type TEXT,
  transcript TEXT,
  confidence REAL,
  accuracy REAL,
  status TEXT DEFAULT 'pass',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL,
  outcome TEXT,
  metrics JSONB,
  issues JSONB,
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_scenarios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  category TEXT DEFAULT 'behavior',
  turns JSONB NOT NULL,
  expectations JSONB,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL
);

-- ── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_date ON insights(date);
CREATE INDEX IF NOT EXISTS idx_insights_metric ON insights(metric);
CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flagged_status ON flagged_conversations(status);
CREATE INDEX IF NOT EXISTS idx_flagged_tenant ON flagged_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runtime_profiles_tenant ON runtime_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runtime_profiles_kind ON runtime_profiles(kind);
CREATE INDEX IF NOT EXISTS idx_journeys_tenant ON journeys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dialog_states_tenant ON dialog_states(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant ON knowledge_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_tenant ON knowledge_gaps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regression_tests_tenant ON regression_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_sims_tenant ON voice_sims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_tenant ON simulation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journey_scenarios_tenant ON journey_scenarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journey_scenarios_journey ON journey_scenarios(journey_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_tenant ON knowledge_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_conversation_ts ON audit_events(conversation_id, ts);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id);

-- HNSW index for approximate nearest-neighbour vector search.
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
  ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops);
