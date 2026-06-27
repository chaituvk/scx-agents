import { Pool, PoolClient } from "pg";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ── PostgreSQL (primary) ────────────────────────────────────────────
let pgPool: Pool | null = null;
let usePostgres = false;

const pgUrl = process.env.DATABASE_URL || "postgresql://sierra:sierra2026@localhost:5432/sierra";

// Pool sizing (Stage 12): default 50 to comfortably support ~100 tenants
// with light concurrent traffic on a single Next.js node. Override via
// DB_POOL_MAX. idleTimeoutMillis intentionally short (30s) so idle
// connections release back to Postgres rather than holding a slot per
// tenant indefinitely.
const poolMax = (() => {
  const raw = process.env.DB_POOL_MAX;
  if (!raw) return 50;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
})();

try {
  pgPool = new Pool({
    connectionString: pgUrl,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pgPool.query("SELECT 1").then(() => {
    usePostgres = true;
    console.log("[db] Connected to PostgreSQL");
    initPgSchema();
    seedDatabase();
  }).catch((err) => {
    console.log("[db] PostgreSQL unavailable, using SQLite:", err.message);
    pgPool = null;
    usePostgres = false;
    // SQLite already initialized eagerly; nothing to do here.
  });
} catch {
  console.log("[db] PostgreSQL not configured, using SQLite");
  pgPool = null;
  usePostgres = false;
}

// ── SQLite (fallback) ───────────────────────────────────────────────
let sqliteDb: Database.Database | null = null;

function initSqlite() {
  if (sqliteDb) return;
  const DB_DIR = path.join(process.cwd(), "data");
  const DB_PATH = path.join(DB_DIR, "sierra.db");
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
  initSqliteSchema();
  seedDatabase();
}

// Initialize SQLite eagerly so the first request never races the async PG probe.
initSqlite();

// ── Unified Query Interface ─────────────────────────────────────────
export interface QueryResult {
  rows: any[];
  rowCount?: number;
}

// Convert positional params [v1, v2] → {$1: v1, $2: v2} for SQLite.
// All SQL in this codebase uses $1/$2 placeholders (PG style).
// better-sqlite3 supports $name named params when passed as a single object.
function toSqliteParams(params: any[]): Record<string, any> {
  const named: Record<string, any> = {};
  // better-sqlite3 strips the sigil: $1 in SQL binds to key "1" in the object.
  params.forEach((v, i) => { named[String(i + 1)] = v; });
  return named;
}

export async function query(sql: string, params: any[] = []): Promise<QueryResult> {
  if (usePostgres && pgPool) {
    const result = await pgPool.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount || undefined };
  }
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    const bound = params.length > 0 ? toSqliteParams(params) : {};
    if (sql.trim().toLowerCase().startsWith("select")) {
      const rows = (params.length > 0 ? stmt.all(bound) : stmt.all()) as any[];
      return { rows, rowCount: rows.length };
    } else {
      const result = params.length > 0 ? stmt.run(bound) : stmt.run();
      return { rows: [], rowCount: result.changes };
    }
  }
  throw new Error("No database available");
}

export async function getOne(sql: string, params: any[] = []): Promise<any | null> {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

export async function run(sql: string, params: any[] = []): Promise<{ changes: number; lastID?: string }> {
  if (usePostgres && pgPool) {
    const result = await pgPool.query(sql, params);
    let lastID: string | undefined;
    if (sql.trim().toLowerCase().startsWith("insert")) {
      try {
        const idResult = await pgPool.query("SELECT lastval()");
        lastID = idResult.rows[0]?.lastval;
      } catch {
        // table may not have a sequence
      }
    }
    return { changes: result.rowCount || 0, lastID };
  }
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    const bound = params.length > 0 ? toSqliteParams(params) : {};
    const result = params.length > 0 ? stmt.run(bound) : stmt.run();
    return { changes: result.changes, lastID: String(result.lastInsertRowid) };
  }
  throw new Error("No database available");
}

export function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (usePostgres && pgPool) {
    return pgPool.connect().then(async (client) => {
      try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    });
  }
  return fn(null as any);
}

export function isPostgres(): boolean {
  return usePostgres;
}

// ── PostgreSQL Schema ───────────────────────────────────────────────
function initPgSchema() {
  if (!pgPool) return;
  pgPool.query(`
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

    -- Migration: GDPR/CCPA compliance — add opt-out flag to users
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ccpa_opt_out BOOLEAN DEFAULT false;

    -- Migration: add tenant_id to existing tables (must run before indexes)
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE integrations ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE flagged_conversations ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE runtime_profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS active_agent TEXT;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS last_intent TEXT;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS pending_action JSONB;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS pending_approval JSONB;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS topic_stack JSONB;
    ALTER TABLE dialog_states ADD COLUMN IF NOT EXISTS handoff_state JSONB;
    ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE knowledge_gaps ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE regression_tests ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE voice_sims ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE;

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

    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
    ON knowledge_embeddings
    USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_tenant ON knowledge_embeddings(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_audit_events_conversation_ts ON audit_events(conversation_id, ts);
    CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id);

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      variants JSONB NOT NULL,
      metric_goal TEXT NOT NULL,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS experiment_assignments (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(experiment_id, conversation_id)
    );

    CREATE INDEX IF NOT EXISTS idx_experiments_tenant ON experiments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_experiment_assignments_exp ON experiment_assignments(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_experiment_assignments_conv ON experiment_assignments(conversation_id);

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      agent_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      system_prompt TEXT NOT NULL,
      is_active BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, agent_type, version)
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_versions_tenant_type ON prompt_versions(tenant_id, agent_type);

    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      persona TEXT DEFAULT '',
      topics JSONB DEFAULT '[]',
      instructions JSONB DEFAULT '[]',
      policies JSONB DEFAULT '[]',
      actions JSONB DEFAULT '[]',
      escalation_triggers JSONB DEFAULT '[]',
      end_message TEXT,
      model_tier TEXT DEFAULT 'reasoning',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_playbooks_tenant ON playbooks(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status);

    CREATE TABLE IF NOT EXISTS playbook_versions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      persona TEXT DEFAULT '',
      topics JSONB DEFAULT '[]',
      instructions JSONB DEFAULT '[]',
      policies JSONB DEFAULT '[]',
      actions JSONB DEFAULT '[]',
      escalation_triggers JSONB DEFAULT '[]',
      end_message TEXT,
      model_tier TEXT,
      change_summary TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(playbook_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook ON playbook_versions(playbook_id);
    CREATE INDEX IF NOT EXISTS idx_playbook_versions_tenant ON playbook_versions(tenant_id);

    CREATE TABLE IF NOT EXISTS proactive_triggers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      trigger_type TEXT NOT NULL DEFAULT 'page_dwell',
      conditions JSONB DEFAULT '{}',
      message TEXT NOT NULL,
      playbook_id TEXT REFERENCES playbooks(id) ON DELETE SET NULL,
      delay_seconds INTEGER DEFAULT 30,
      cooldown_hours INTEGER DEFAULT 24,
      priority INTEGER DEFAULT 100,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_proactive_triggers_tenant ON proactive_triggers(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_proactive_triggers_status ON proactive_triggers(status);

    CREATE TABLE IF NOT EXISTS playbooks (
      conversation_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      playbook_id TEXT NOT NULL,
      variables JSONB DEFAULT '{}',
      turn_count INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (conversation_id, tenant_id)
    );
    CREATE INDEX IF NOT EXISTS idx_playbook_states_tenant ON playbook_states(tenant_id);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      scopes JSONB DEFAULT '["read","write"]',
      status TEXT NOT NULL DEFAULT 'active',
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events JSONB DEFAULT '["conversation.created","message.sent","escalation.triggered","conversation.closed"]',
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_attempt_at TIMESTAMPTZ,
      next_retry_at TIMESTAMPTZ,
      response_status INTEGER,
      response_body TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

    CREATE TABLE IF NOT EXISTS csat_ratings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment TEXT,
      agent_id TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(conversation_id)
    );
    CREATE INDEX IF NOT EXISTS idx_csat_tenant ON csat_ratings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_csat_conversation ON csat_ratings(conversation_id);

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      source_id TEXT REFERENCES knowledge_sources(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      chunk_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant ON knowledge_documents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_source ON knowledge_documents(source_id);

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id TEXT,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      agent_type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_tenant ON token_usage(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_conv ON token_usage(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);

    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_email TEXT;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_tokens_per_turn INTEGER DEFAULT 2000;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS inactivity_timeout_mins INTEGER DEFAULT 30;

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      channel TEXT NOT NULL DEFAULT 'sms',
      message_template TEXT,
      use_ai_personalization BOOLEAN DEFAULT false,
      playbook_id TEXT REFERENCES playbooks(id) ON DELETE SET NULL,
      scheduled_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      contact_id TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      variables JSONB DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      error TEXT,
      conversation_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_tenant ON campaign_contacts(tenant_id);

    CREATE TABLE IF NOT EXISTS customer_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      external_id TEXT,
      email TEXT,
      phone TEXT,
      name TEXT,
      channel TEXT,
      language TEXT DEFAULT 'en',
      timezone TEXT,
      tags JSONB DEFAULT '[]',
      custom_attributes JSONB DEFAULT '{}',
      total_conversations INTEGER DEFAULT 0,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, email),
      UNIQUE(tenant_id, phone)
    );
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_tenant ON customer_profiles(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_external ON customer_profiles(external_id);

    CREATE TABLE IF NOT EXISTS customer_memories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      conversation_id TEXT,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customer_memories_customer ON customer_memories(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_memories_tenant ON customer_memories(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customer_memories_type ON customer_memories(memory_type);

    CREATE TABLE IF NOT EXISTS conversation_tags (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (conversation_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_conv_tags_tenant ON conversation_tags(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_conv_tags_tag ON conversation_tags(tag);

    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'active',
      conditions JSONB NOT NULL DEFAULT '[]',
      condition_logic TEXT NOT NULL DEFAULT 'any',
      action_type TEXT NOT NULL,
      action_payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_routing_rules_tenant ON routing_rules(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_routing_rules_status ON routing_rules(status);
    CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON routing_rules(tenant_id, priority);

    CREATE TABLE IF NOT EXISTS sla_configs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      first_response_minutes INTEGER NOT NULL DEFAULT 60,
      resolution_minutes INTEGER NOT NULL DEFAULT 480,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sla_configs_tenant ON sla_configs(tenant_id);

    CREATE TABLE IF NOT EXISTS sla_breaches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sla_config_id TEXT REFERENCES sla_configs(id) ON DELETE SET NULL,
      breach_type TEXT NOT NULL,
      breached_at TIMESTAMPTZ NOT NULL,
      acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sla_breaches_tenant ON sla_breaches(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sla_breaches_conv ON sla_breaches(conversation_id);

    CREATE TABLE IF NOT EXISTS canned_responses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      tags JSONB DEFAULT '[]',
      shortcut TEXT,
      use_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_canned_responses_tenant ON canned_responses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_canned_responses_category ON canned_responses(category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON canned_responses(tenant_id, shortcut) WHERE shortcut IS NOT NULL;
  `).catch((err) => console.log("[db] PG schema init warning:", err.message));
}

// ── SQLite Schema ───────────────────────────────────────────────────
function initSqliteSchema() {
  if (!sqliteDb) return;
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      primary_color TEXT DEFAULT '#c4a574',
      accent_color TEXT DEFAULT '#0a0a0a',
      welcome_message TEXT,
      tone TEXT DEFAULT 'empathetic',
      off_limit_topics TEXT,
      off_limit_phrases TEXT,
      approval_threshold INTEGER DEFAULT 500,
      require_approval INTEGER DEFAULT 1,
      config TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, email)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      goals TEXT,
      skills TEXT,
      guardrails TEXT,
      languages TEXT,
      channels TEXT,
      tone TEXT DEFAULT 'empathetic',
      welcome_message TEXT,
      primary_color TEXT DEFAULT '#c4a574',
      accent_color TEXT DEFAULT '#0a0a0a',
      off_limit_topics TEXT,
      off_limit_phrases TEXT,
      approval_threshold INTEGER DEFAULT 500,
      require_approval INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_id TEXT,
      intent TEXT,
      groundings TEXT,
      confidence REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'disconnected',
      config TEXT,
      records TEXT,
      last_sync TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runtime_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'specialist',
      status TEXT DEFAULT 'active',
      description TEXT,
      allowed_journeys TEXT,
      allowed_tools TEXT,
      allowed_slots TEXT,
      guardrails TEXT,
      policies TEXT,
      config TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      nodes TEXT NOT NULL,
      edges TEXT,
      variables TEXT,
      execution_mode TEXT DEFAULT 'deterministic',
      status TEXT DEFAULT 'draft',
      version TEXT DEFAULT '1.0.0',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dialog_states (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL,
      current_node_id TEXT,
      variables TEXT,
      history TEXT,
      context TEXT,
      done INTEGER DEFAULT 0,
      active_agent TEXT,
      last_intent TEXT,
      pending_action TEXT,
      pending_approval TEXT,
      topic_stack TEXT,
      handoff_state TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      gaps TEXT,
      config TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      frequency INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      suggested_answer TEXT,
      source_ids TEXT,
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      scenario_name TEXT NOT NULL,
      outcome TEXT,
      metrics TEXT,
      issues TEXT,
      messages TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_scenarios (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      category TEXT DEFAULT 'behavior',
      turns TEXT NOT NULL,
      expectations TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

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
    CREATE INDEX IF NOT EXISTS idx_audit_events_conversation_ts ON audit_events(conversation_id, ts);
    CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_journey_scenarios_tenant ON journey_scenarios(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_journey_scenarios_journey ON journey_scenarios(journey_id);

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, status TEXT DEFAULT 'draft', variants TEXT NOT NULL,
      metric_goal TEXT NOT NULL, started_at TEXT, ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS experiment_assignments (
      id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
      variant_id TEXT NOT NULL, assigned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(experiment_id, conversation_id)
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_type TEXT NOT NULL,
      version INTEGER NOT NULL, system_prompt TEXT NOT NULL,
      is_active INTEGER DEFAULT 0, notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, agent_type, version)
    );

    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      persona TEXT DEFAULT '',
      topics TEXT DEFAULT '[]',
      instructions TEXT DEFAULT '[]',
      policies TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      escalation_triggers TEXT DEFAULT '[]',
      end_message TEXT,
      model_tier TEXT DEFAULT 'reasoning',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS playbook_versions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      persona TEXT DEFAULT '',
      topics TEXT DEFAULT '[]',
      instructions TEXT DEFAULT '[]',
      policies TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      escalation_triggers TEXT DEFAULT '[]',
      end_message TEXT,
      model_tier TEXT,
      change_summary TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(playbook_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook ON playbook_versions(playbook_id);

    CREATE TABLE IF NOT EXISTS proactive_triggers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      trigger_type TEXT NOT NULL DEFAULT 'page_dwell',
      conditions TEXT DEFAULT '{}',
      message TEXT NOT NULL,
      playbook_id TEXT,
      delay_seconds INTEGER DEFAULT 30,
      cooldown_hours INTEGER DEFAULT 24,
      priority INTEGER DEFAULT 100,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_proactive_triggers_tenant ON proactive_triggers(tenant_id);

    CREATE TABLE IF NOT EXISTS playbook_states (
      conversation_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      playbook_id TEXT NOT NULL,
      variables TEXT DEFAULT '{}',
      turn_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      scopes TEXT DEFAULT '["read","write"]',
      status TEXT NOT NULL DEFAULT 'active',
      last_used_at TEXT,
      expires_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT DEFAULT '["conversation.created","message.sent","escalation.triggered","conversation.closed"]',
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      response_status INTEGER,
      response_body TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

    CREATE TABLE IF NOT EXISTS csat_ratings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment TEXT,
      agent_id TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(conversation_id)
    );
    CREATE INDEX IF NOT EXISTS idx_csat_tenant ON csat_ratings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_csat_conversation ON csat_ratings(conversation_id);

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      source_id TEXT REFERENCES knowledge_sources(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      chunk_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant ON knowledge_documents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_docs_source ON knowledge_documents(source_id);

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      conversation_id TEXT,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      agent_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_tenant ON token_usage(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_conv ON token_usage(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      channel TEXT NOT NULL DEFAULT 'sms',
      message_template TEXT,
      use_ai_personalization INTEGER DEFAULT 0,
      playbook_id TEXT,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      contact_id TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      variables TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      delivered_at TEXT,
      failed_at TEXT,
      error TEXT,
      conversation_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_tenant ON campaign_contacts(tenant_id);

    CREATE TABLE IF NOT EXISTS customer_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      external_id TEXT,
      email TEXT,
      phone TEXT,
      name TEXT,
      channel TEXT,
      language TEXT DEFAULT 'en',
      timezone TEXT,
      tags TEXT DEFAULT '[]',
      custom_attributes TEXT DEFAULT '{}',
      total_conversations INTEGER DEFAULT 0,
      last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, email),
      UNIQUE(tenant_id, phone)
    );
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_tenant ON customer_profiles(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_external ON customer_profiles(external_id);

    CREATE TABLE IF NOT EXISTS customer_memories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      conversation_id TEXT,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customer_memories_customer ON customer_memories(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_memories_tenant ON customer_memories(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customer_memories_type ON customer_memories(memory_type);

    CREATE TABLE IF NOT EXISTS conversation_tags (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_conv_tags_tenant ON conversation_tags(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_conv_tags_tag ON conversation_tags(tag);

    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'active',
      conditions TEXT NOT NULL DEFAULT '[]',
      condition_logic TEXT NOT NULL DEFAULT 'any',
      action_type TEXT NOT NULL,
      action_payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_routing_rules_tenant ON routing_rules(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_routing_rules_status ON routing_rules(status);
    CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON routing_rules(tenant_id, priority);

    CREATE TABLE IF NOT EXISTS sla_configs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      first_response_minutes INTEGER NOT NULL DEFAULT 60,
      resolution_minutes INTEGER NOT NULL DEFAULT 480,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sla_configs_tenant ON sla_configs(tenant_id);

    CREATE TABLE IF NOT EXISTS sla_breaches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sla_config_id TEXT REFERENCES sla_configs(id) ON DELETE SET NULL,
      breach_type TEXT NOT NULL,
      breached_at TEXT NOT NULL,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sla_breaches_tenant ON sla_breaches(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sla_breaches_conv ON sla_breaches(conversation_id);

    CREATE TABLE IF NOT EXISTS canned_responses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      tags TEXT DEFAULT '[]',
      shortcut TEXT,
      use_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_canned_responses_tenant ON canned_responses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_canned_responses_category ON canned_responses(category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON canned_responses(tenant_id, shortcut);
  `);

  // Idempotent additive column migrations for existing SQLite databases.
  // SQLite ADD COLUMN doesn't support IF NOT EXISTS, so we check via PRAGMA.
  const dialogCols = sqliteDb.prepare("PRAGMA table_info(dialog_states)").all() as { name: string }[];
  const existing = new Set(dialogCols.map((c) => c.name));
  const additions: Array<[string, string]> = [
    ["active_agent", "TEXT"],
    ["last_intent", "TEXT"],
    ["pending_action", "TEXT"],
    ["pending_approval", "TEXT"],
    ["topic_stack", "TEXT"],
    ["handoff_state", "TEXT"],
  ];
  for (const [name, type] of additions) {
    if (!existing.has(name)) {
      sqliteDb.exec(`ALTER TABLE dialog_states ADD COLUMN ${name} ${type}`);
    }
  }

  // GDPR/CCPA: add ccpa_opt_out to users table
  const userCols = sqliteDb.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const userColSet = new Set(userCols.map((c) => c.name));
  if (!userColSet.has("ccpa_opt_out")) {
    sqliteDb.exec(`ALTER TABLE users ADD COLUMN ccpa_opt_out INTEGER DEFAULT 0`);
  }

  // Add new tenant settings columns
  const tenantCols = sqliteDb.prepare("PRAGMA table_info(tenants)").all() as { name: string }[];
  const tenantColSet = new Set(tenantCols.map((c) => c.name));
  const tenantAdditions: Array<[string, string]> = [
    ["logo_url", "TEXT"],
    ["support_email", "TEXT"],
    ["timezone", "TEXT DEFAULT 'UTC'"],
    ["language", "TEXT DEFAULT 'en'"],
    ["max_tokens_per_turn", "INTEGER DEFAULT 2000"],
    ["inactivity_timeout_mins", "INTEGER DEFAULT 30"],
  ];
  for (const [name, type] of tenantAdditions) {
    if (!tenantColSet.has(name)) {
      sqliteDb.exec(`ALTER TABLE tenants ADD COLUMN ${name} ${type}`);
    }
  }
}

// ── Seed ────────────────────────────────────────────────────────────
async function seedDatabase() {
  let count = 0;
  try {
    if (usePostgres && pgPool) {
      const result = await pgPool.query("SELECT COUNT(*) as count FROM tenants");
      count = parseInt(result.rows[0].count);
    } else if (sqliteDb) {
      const row = sqliteDb.prepare("SELECT COUNT(*) as count FROM tenants").get() as any;
      count = row?.count || 0;
    }
  } catch {
    count = 0;
  }

  if (count === 0) {
    console.log("[seed] Seeding database...");
    await doSeed();
  }

  // Always ensure superadmin exists
  try {
    const superadmin = await getOne("SELECT * FROM users WHERE email = $1", ["superadmin@sierra.ai"]);
    if (!superadmin) {
      console.log("[seed] Adding superadmin user...");
      const bcrypt = require("bcryptjs");
      const passwordHash = bcrypt.hashSync("sierra2026", 10);
      const now = new Date().toISOString();
      if (usePostgres && pgPool) {
        await pgPool.query(
          "INSERT INTO users (id, tenant_id, email, name, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING",
          ["user-super", "r-mobile", "superadmin@sierra.ai", "Super Admin", passwordHash, "superadmin", now]
        );
      } else if (sqliteDb) {
        sqliteDb.prepare("INSERT OR IGNORE INTO users (id, tenant_id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("user-super", "r-mobile", "superadmin@sierra.ai", "Super Admin", passwordHash, "superadmin", now);
      }
    }
  } catch (err) {
    console.log("[seed] Superadmin check skipped:", (err as Error).message);
  }

  try {
    const { seedStudioData } = await import("./seed-studio");
    await seedStudioData();
  } catch (err) {
    console.log("[seed] Studio seed skipped:", (err as Error).message);
  }

  try {
    const { seedMvpFixtures } = await import("./seed-mvp-fixtures");
    await seedMvpFixtures();
  } catch (err) {
    console.log("[seed] MVP fixture seed skipped:", (err as Error).message);
  }
}

async function doSeed() {
  const bcrypt = require("bcryptjs");
  const passwordHash = bcrypt.hashSync("sierra2026", 10);
  const now = new Date().toISOString();

  const runQ = async (sql: string, params: any[]) => {
    let pgSql = sql;
    if (usePostgres && pgPool) {
      // Convert SQLite INSERT OR IGNORE to Postgres INSERT ... ON CONFLICT DO NOTHING
      if (pgSql.trim().toUpperCase().startsWith("INSERT OR IGNORE INTO")) {
        pgSql = pgSql.replace(/INSERT OR IGNORE INTO/i, "INSERT INTO") + " ON CONFLICT DO NOTHING";
      }
      // Convert ? placeholders to $1, $2, ... for Postgres
      let idx = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);
      return pgPool.query(pgSql, params);
    }
    if (sqliteDb) {
      return sqliteDb.prepare(sql).run(...params);
    }
  };

  // ── Tenants ──────────────────────────────────────────────────────
  const tenants = [
    { id: "r-mobile", name: "R-Mobile", slug: "r-mobile", primary_color: "#ef4444", accent_color: "#1e293b", welcome_message: "Welcome to R-Mobile! How can we help with your device or plan today?", tone: "professional", off_limit_topics: JSON.stringify(["Competitor pricing", "Unlocking devices", "Third-party repairs"]), off_limit_phrases: JSON.stringify(["I don't know", "That's not my department", "Call back later"]), approval_threshold: 300, require_approval: 1 },
    { id: "ichiba", name: "Ichiba", slug: "ichiba", primary_color: "#f97316", accent_color: "#0f172a", welcome_message: "Konnichiwa! Welcome to Ichiba. What can we help you find today?", tone: "empathetic", off_limit_topics: JSON.stringify(["Counterfeit items", "Illegal goods", "Tax evasion"]), off_limit_phrases: JSON.stringify(["Not my problem", "Figure it out yourself", "I am busy"]), approval_threshold: 500, require_approval: 1 },
    { id: "r-travel", name: "RTravel", slug: "r-travel", primary_color: "#06b6d4", accent_color: "#0f172a", welcome_message: "Hello traveler! Ready to plan your next adventure?", tone: "enthusiastic", off_limit_topics: JSON.stringify(["Visa fraud", "Illegal destinations", "Travel insurance scams"]), off_limit_phrases: JSON.stringify(["I don't care", "That's your fault", "Nothing I can do"]), approval_threshold: 1000, require_approval: 1 },
  ];

  for (const t of tenants) {
    await runQ(
      `INSERT OR IGNORE INTO tenants (id, name, slug, primary_color, accent_color, welcome_message, tone, off_limit_topics, off_limit_phrases, approval_threshold, require_approval, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.name, t.slug, t.primary_color, t.accent_color, t.welcome_message, t.tone, t.off_limit_topics, t.off_limit_phrases, t.approval_threshold, t.require_approval, now, now]
    );
  }

  // ── Users (one per tenant + superadmin) ─────────────────────────
  await runQ(
    `INSERT OR IGNORE INTO users (id, tenant_id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["user-1", "r-mobile", "admin@sierra.ai", "Admin User", passwordHash, "admin", now]
  );
  await runQ(
    `INSERT OR IGNORE INTO users (id, tenant_id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["user-2", "ichiba", "admin@ichiba.ai", "Ichiba Admin", passwordHash, "admin", now]
  );
  await runQ(
    `INSERT OR IGNORE INTO users (id, tenant_id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["user-3", "r-travel", "admin@rtravel.ai", "RTravel Admin", passwordHash, "admin", now]
  );
  await runQ(
    `INSERT OR IGNORE INTO users (id, tenant_id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["user-super", "r-mobile", "superadmin@sierra.ai", "Super Admin", passwordHash, "superadmin", now]
  );

  // ── Agents (per tenant) ──────────────────────────────────────────
  const agents = [
    { id: "agent-1", tenant_id: "r-mobile", name: "R-Mobile Support", description: "Handles device issues, plans, billing", status: "production", goals: JSON.stringify(["Resolve issues", "Maintain CSAT"]), skills: JSON.stringify(["device_support", "plan_lookup", "billing"]), guardrails: JSON.stringify(["Never blame customer", "Max credit $300 without approval"]), languages: JSON.stringify(["English"]), channels: JSON.stringify(["web", "chat"]), tone: "professional", welcome_message: "Welcome to R-Mobile! How can we help?", primary_color: "#ef4444", accent_color: "#1e293b", off_limit_topics: JSON.stringify(["Competitor pricing"]), off_limit_phrases: JSON.stringify(["I don't know"]), approval_threshold: 300, require_approval: 1 },
    { id: "agent-2", tenant_id: "r-mobile", name: "R-Mobile Sales", description: "Drives upsells and retention", status: "production", goals: JSON.stringify(["Increase AOV", "Drive retention"]), skills: JSON.stringify(["product_recommendation", "promo_code_management"]), guardrails: JSON.stringify(["Never make false claims", "Disclose terms"]), languages: JSON.stringify(["English"]), channels: JSON.stringify(["web", "chat"]), tone: "enthusiastic", welcome_message: "Hey there! Looking for a new device or plan?", primary_color: "#ef4444", accent_color: "#1e293b", off_limit_topics: JSON.stringify(["Competitor pricing"]), off_limit_phrases: JSON.stringify(["I don't know"]), approval_threshold: 300, require_approval: 1 },
    { id: "agent-3", tenant_id: "ichiba", name: "Ichiba Support", description: "Handles orders, shipping, returns", status: "production", goals: JSON.stringify(["Resolve issues", "Maintain CSAT"]), skills: JSON.stringify(["order_lookup", "return_processing", "refund_handling"]), guardrails: JSON.stringify(["Never blame customer", "Max refund $500 without approval"]), languages: JSON.stringify(["English", "Japanese"]), channels: JSON.stringify(["web", "chat"]), tone: "empathetic", welcome_message: "Konnichiwa! How can we help today?", primary_color: "#f97316", accent_color: "#0f172a", off_limit_topics: JSON.stringify(["Counterfeit items"]), off_limit_phrases: JSON.stringify(["Not my problem"]), approval_threshold: 500, require_approval: 1 },
    { id: "agent-4", tenant_id: "r-travel", name: "RTravel Concierge", description: "Handles bookings, cancellations, recommendations", status: "production", goals: JSON.stringify(["Book trips", "Handle changes"]), skills: JSON.stringify(["booking_lookup", "cancellation_processing", "recommendation"]), guardrails: JSON.stringify(["Never overpromise", "Disclose fees"]), languages: JSON.stringify(["English"]), channels: JSON.stringify(["web", "chat"]), tone: "enthusiastic", welcome_message: "Hello traveler! Where to next?", primary_color: "#06b6d4", accent_color: "#0f172a", off_limit_topics: JSON.stringify(["Visa fraud"]), off_limit_phrases: JSON.stringify(["I don't care"]), approval_threshold: 1000, require_approval: 1 },
  ];

  for (const a of agents) {
    await runQ(
      `INSERT OR IGNORE INTO agents (id, tenant_id, name, description, status, goals, skills, guardrails, languages, channels, tone, welcome_message, primary_color, accent_color, off_limit_topics, off_limit_phrases, approval_threshold, require_approval, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.tenant_id, a.name, a.description, a.status, a.goals, a.skills, a.guardrails, a.languages, a.channels, a.tone, a.welcome_message, a.primary_color, a.accent_color, a.off_limit_topics, a.off_limit_phrases, a.approval_threshold, a.require_approval, now, now, "1.0.0"]
    );
  }

  // ── Conversations (per tenant) ───────────────────────────────────
  const conversations = [
    { id: "conv-1", tenant_id: "r-mobile", customer_name: "Sarah Johnson", customer_email: "sarah@example.com", channel: "web", status: "open", sentiment: "neutral", agent_id: "agent-1", assigned_to: "R-Mobile Support", topic: "device_issue", priority: "normal", created_at: "2026-04-30T10:00:00Z" },
    { id: "conv-2", tenant_id: "ichiba", customer_name: "Taro Tanaka", customer_email: "taro@example.com", channel: "web", status: "open", sentiment: "neutral", agent_id: "agent-3", assigned_to: "Ichiba Support", topic: "return", priority: "normal", created_at: "2026-04-30T11:00:00Z" },
    { id: "conv-3", tenant_id: "r-travel", customer_name: "Emma Wilson", customer_email: "emma@example.com", channel: "web", status: "open", sentiment: "positive", agent_id: "agent-4", assigned_to: "RTravel Concierge", topic: "booking", priority: "normal", created_at: "2026-04-30T12:00:00Z" },
  ];

  for (const c of conversations) {
    await runQ(
      `INSERT OR IGNORE INTO conversations (id, tenant_id, customer_name, customer_email, channel, status, sentiment, agent_id, assigned_to, topic, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.tenant_id, c.customer_name, c.customer_email, c.channel, c.status, c.sentiment, c.agent_id, c.assigned_to, c.topic, c.priority, c.created_at, now]
    );
  }

  // ── Messages (per tenant) ────────────────────────────────────────
  const messages = [
    { id: "msg-1", tenant_id: "r-mobile", conversation_id: "conv-1", role: "user", content: "Hi, my phone screen is cracked. Can you help?", agent_id: null, intent: "device_issue", created_at: "2026-04-30T10:01:00Z" },
    { id: "msg-2", tenant_id: "ichiba", conversation_id: "conv-2", role: "user", content: "Hi, I need to return my order.", agent_id: null, intent: "return", created_at: "2026-04-30T11:01:00Z" },
    { id: "msg-3", tenant_id: "r-travel", conversation_id: "conv-3", role: "user", content: "Hi, I want to book a trip to Tokyo.", agent_id: null, intent: "booking", created_at: "2026-04-30T12:01:00Z" },
  ];

  for (const m of messages) {
    await runQ(
      `INSERT OR IGNORE INTO messages (id, tenant_id, conversation_id, role, content, agent_id, intent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.tenant_id, m.conversation_id, m.role, m.content, m.agent_id, m.intent, m.created_at]
    );
  }

  // ── Integrations (per tenant) ────────────────────────────────────
  const integrations = [
    { id: "int-1", tenant_id: "r-mobile", name: "Device Inventory", type: "CRM", status: "connected", records: "2.4M", last_sync: "15 min ago", config: JSON.stringify({ endpoint: "https://api.rmobile.com/devices" }) },
    { id: "int-2", tenant_id: "r-mobile", name: "Billing System", type: "Payment", status: "connected", records: "1.8M", last_sync: "1 hour ago", config: JSON.stringify({ endpoint: "https://api.rmobile.com/billing" }) },
    { id: "int-3", tenant_id: "ichiba", name: "Shopify", type: "E-commerce", status: "connected", records: "1.8M", last_sync: "1 hour ago", config: JSON.stringify({ endpoint: "https://ichiba.myshopify.com" }) },
    { id: "int-4", tenant_id: "ichiba", name: "Stripe", type: "Payment", status: "connected", records: "890K", last_sync: "5 min ago", config: JSON.stringify({ endpoint: "https://api.stripe.com" }) },
    { id: "int-5", tenant_id: "r-travel", name: "Amadeus", type: "Travel", status: "connected", records: "500K", last_sync: "10 min ago", config: JSON.stringify({ endpoint: "https://api.amadeus.com" }) },
    { id: "int-6", tenant_id: "r-travel", name: "Booking.com", type: "Travel", status: "syncing", records: "1.2M", last_sync: "in progress", config: JSON.stringify({ endpoint: "https://api.booking.com" }) },
  ];

  for (const i of integrations) {
    await runQ(
      `INSERT OR IGNORE INTO integrations (id, tenant_id, name, type, status, config, records, last_sync, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [i.id, i.tenant_id, i.name, i.type, i.status, i.config, i.records, i.last_sync, now, now]
    );
  }

  // ── Insights (per tenant, last 7 days) ───────────────────────────
  for (const tenantId of ["r-mobile", "ichiba", "r-travel"]) {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      await runQ(
        `INSERT OR IGNORE INTO insights (id, tenant_id, date, metric, value, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`ins-${tenantId}-${i}-1`, tenantId, ds, "conversations", Math.floor(Math.random() * 500) + 1200, "volume", d.toISOString()]
      );
      await runQ(
        `INSERT OR IGNORE INTO insights (id, tenant_id, date, metric, value, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`ins-${tenantId}-${i}-2`, tenantId, ds, "resolution_rate", 88 + Math.floor(Math.random() * 10), "quality", d.toISOString()]
      );
    }
  }

  // ── Journeys (per tenant) ────────────────────────────────────────
  const journeys = [
    // ── R-Mobile ─────────────────────────────────────────────────────
    { id: "journey-1", tenant_id: "r-mobile", name: "Device Troubleshooting", mode: "deterministic", desc: "Helps customers troubleshoot device issues",
      nodes: [
        {id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},
        {id:"n2",type:"message",label:"Greeting",position:{x:100,y:200},data:{text:"I can help troubleshoot your device."}},
        {id:"n3",type:"input",label:"Device Model",position:{x:100,y:300},data:{prompt:"What device model are you using? (e.g. iPhone 15, Galaxy S24)",variable:"device_model"}},
        {id:"n4",type:"message",label:"Steps",position:{x:100,y:400},data:{text:"Thanks! For {{device_model}}, please try:\n1. Restart your device\n2. Check for software updates\n3. Reset network settings\n4. Contact support if issue persists"}},
        {id:"n5",type:"end",label:"End",position:{x:100,y:500},data:{text:"Hope that helps! Reach out anytime."}}
      ],
      edges: [{id:"e1",source:"n1",target:"n2"},{id:"e2",source:"n2",target:"n3"},{id:"e3",source:"n3",target:"n4"},{id:"e4",source:"n4",target:"n5"}],
      vars: ["device_model"] },

    { id: "journey-2", tenant_id: "r-mobile", name: "Plan Upgrade Assistant", mode: "llm", desc: "AI assistant for plan upgrades",
      nodes: [{id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},{id:"n2",type:"end",label:"End",position:{x:100,y:200},data:{text:"Thank you!"}}],
      edges: [{id:"e1",source:"n1",target:"n2"}],
      vars: [] },

    // ── Ichiba ───────────────────────────────────────────────────────
    { id: "journey-3", tenant_id: "ichiba", name: "Return & Refund Flow", mode: "deterministic", desc: "Handles returns and refunds",
      nodes: [
        {id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},
        {id:"n2",type:"message",label:"Greeting",position:{x:100,y:200},data:{text:"I can help with your return or refund."}},
        {id:"n3",type:"input",label:"Order #",position:{x:100,y:300},data:{prompt:"What's your order number?",variable:"order_number"}},
        {id:"n4",type:"message",label:"Policy",position:{x:100,y:400},data:{text:"Got it — order {{order_number}}. Returns accepted within 30 days with original packaging."}},
        {id:"n5",type:"input",label:"Condition",position:{x:100,y:500},data:{prompt:"Is your item unopened with original packaging? (yes/no)",variable:"unopened"}},
        {id:"n6",type:"condition",label:"Unopened?",position:{x:100,y:600},data:{variable:"unopened",condition:"eq yes"}},
        {id:"n7",type:"message",label:"Approved",position:{x:300,y:600},data:{text:"Perfect! Your return is approved. Pack the item and drop it at any courier location. Refund in 3-5 business days."}},
        {id:"n8",type:"end",label:"End",position:{x:300,y:700},data:{}},
        {id:"n9",type:"message",label:"Opened",position:{x:0,y:600},data:{text:"Opened items may still qualify. Let me connect you with a returns specialist."}},
        {id:"n10",type:"transfer",label:"Agent",position:{x:0,y:700},data:{department:"Returns",reason:"Opened item return"}}
      ],
      edges: [
        {id:"e1",source:"n1",target:"n2"},
        {id:"e2",source:"n2",target:"n3"},
        {id:"e3",source:"n3",target:"n4"},
        {id:"e4",source:"n4",target:"n5"},
        {id:"e5",source:"n5",target:"n6"},
        {id:"e6",source:"n6",target:"n7",condition:"eq yes"},
        {id:"e7",source:"n6",target:"n9"},
        {id:"e8",source:"n7",target:"n8"},
        {id:"e9",source:"n9",target:"n10"}
      ],
      vars: ["order_number","unopened"] },

    { id: "journey-4", tenant_id: "ichiba", name: "Shipping & Tracking", mode: "deterministic", desc: "Tracks orders and shipping",
      nodes: [
        {id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},
        {id:"n2",type:"message",label:"Intro",position:{x:100,y:200},data:{text:"I can track your shipment."}},
        {id:"n3",type:"input",label:"Order #",position:{x:100,y:300},data:{prompt:"What's your order number?",variable:"order_number"}},
        {id:"n4",type:"message",label:"Status",position:{x:100,y:400},data:{text:"Order {{order_number}} is in transit! Expected delivery: 2-3 business days."}},
        {id:"n5",type:"end",label:"End",position:{x:100,y:500},data:{text:"Have a great day!"}}
      ],
      edges: [{id:"e1",source:"n1",target:"n2"},{id:"e2",source:"n2",target:"n3"},{id:"e3",source:"n3",target:"n4"},{id:"e4",source:"n4",target:"n5"}],
      vars: ["order_number"] },

    // ── R-Travel ─────────────────────────────────────────────────────
    { id: "journey-5", tenant_id: "r-travel", name: "Booking Assistant", mode: "llm", desc: "AI booking assistant",
      nodes: [{id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},{id:"n2",type:"end",label:"End",position:{x:100,y:200},data:{text:"Enjoy your trip!"}}],
      edges: [{id:"e1",source:"n1",target:"n2"}],
      vars: [] },

    { id: "journey-6", tenant_id: "r-travel", name: "Cancellation & Refund", mode: "deterministic", desc: "Handles booking cancellations",
      nodes: [
        {id:"n1",type:"start",label:"Start",position:{x:100,y:100},data:{}},
        {id:"n2",type:"message",label:"Intro",position:{x:100,y:200},data:{text:"I can help with cancellations."}},
        {id:"n3",type:"input",label:"Booking Ref",position:{x:100,y:300},data:{prompt:"What's your booking reference?",variable:"booking_ref"}},
        {id:"n4",type:"message",label:"Lookup",position:{x:100,y:400},data:{text:"Looking up booking {{booking_ref}}..."}},
        {id:"n5",type:"input",label:"48h Check",position:{x:100,y:500},data:{prompt:"Is your departure more than 48 hours away? (yes/no)",variable:"free_cancel"}},
        {id:"n6",type:"condition",label:"Free Cancel?",position:{x:100,y:600},data:{variable:"free_cancel",condition:"eq yes"}},
        {id:"n7",type:"message",label:"Free",position:{x:300,y:600},data:{text:"Free cancellation applies! Your refund will be processed in 5-7 business days."}},
        {id:"n8",type:"end",label:"End",position:{x:300,y:700},data:{}},
        {id:"n9",type:"message",label:"Fee",position:{x:0,y:600},data:{text:"Within 48 hours — a $50 cancellation fee applies. Would you like to proceed?"}},
        {id:"n10",type:"input",label:"Confirm",position:{x:0,y:700},data:{prompt:"Type 'confirm' to proceed with cancellation (or 'cancel' to keep booking)",variable:"confirm_cancel"}},
        {id:"n11",type:"condition",label:"Confirmed?",position:{x:0,y:800},data:{variable:"confirm_cancel",condition:"eq confirm"}},
        {id:"n12",type:"message",label:"Done",position:{x:200,y:800},data:{text:"Cancellation confirmed. Refund minus $50 fee will be processed in 5-7 days."}},
        {id:"n13",type:"end",label:"End",position:{x:200,y:900},data:{}},
        {id:"n14",type:"message",label:"Kept",position:{x:0,y:900},data:{text:"No problem. Your booking remains active. Have a wonderful trip!"}},
        {id:"n15",type:"end",label:"End2",position:{x:0,y:1000},data:{}}
      ],
      edges: [
        {id:"e1",source:"n1",target:"n2"},
        {id:"e2",source:"n2",target:"n3"},
        {id:"e3",source:"n3",target:"n4"},
        {id:"e4",source:"n4",target:"n5"},
        {id:"e5",source:"n5",target:"n6"},
        {id:"e6",source:"n6",target:"n7",condition:"eq yes"},
        {id:"e7",source:"n6",target:"n9"},
        {id:"e8",source:"n7",target:"n8"},
        {id:"e9",source:"n9",target:"n10"},
        {id:"e10",source:"n10",target:"n11"},
        {id:"e11",source:"n11",target:"n12",condition:"eq confirm"},
        {id:"e12",source:"n11",target:"n14"},
        {id:"e13",source:"n12",target:"n13"},
        {id:"e14",source:"n14",target:"n15"}
      ],
      vars: ["booking_ref","free_cancel","confirm_cancel"] },
  ];

  for (const j of journeys) {
    await runQ(
      `INSERT OR IGNORE INTO journeys (id, tenant_id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [j.id, j.tenant_id, j.name, j.desc, JSON.stringify(j.nodes), JSON.stringify(j.edges), JSON.stringify(j.vars), j.mode, "active", "1.0.0", now, now]
    );
  }

  // ── Flagged Conversations ────────────────────────────────────────
  await runQ(
    `INSERT OR IGNORE INTO flagged_conversations (id, tenant_id, conversation_id, reason, severity, status, assigned_to, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["flag-1", "r-mobile", "conv-1", "Customer demanding free replacement out of warranty", "high", "open", "manager@rmobile.ai", "Requires manager approval", now]
  );

  // ── Knowledge Sources ────────────────────────────────────────────
  const ksData = [
    { id: "ks-1", tenant_id: "r-mobile", name: "Device Support Articles", type: "help-center", status: "active", entries: 156, url: "https://support.rmobile.com/hc", last_sync: "2 min ago", gaps: null, config: { auto_sync: true, frequency: "daily" } },
    { id: "ks-2", tenant_id: "r-mobile", name: "Warranty Policy", type: "policy", status: "active", entries: 8, url: "https://rmobile.com/policies/warranty", last_sync: "1 hour ago", gaps: null, config: { auto_sync: true, frequency: "weekly" } },
    { id: "ks-3", tenant_id: "ichiba", name: "Return & Refund Policy", type: "policy", status: "active", entries: 12, url: "https://ichiba.com/policies/returns", last_sync: "1 hour ago", gaps: null, config: { auto_sync: true, frequency: "weekly" } },
    { id: "ks-4", tenant_id: "ichiba", name: "Shipping Guidelines", type: "policy", status: "error", entries: 8, url: "https://ichiba.com/policies/shipping", last_sync: "3 days ago", gaps: ["Missing international shipping info", "No holiday cutoff dates"], config: { auto_sync: false } },
    { id: "ks-5", tenant_id: "r-travel", name: "Destination Guides", type: "faq", status: "active", entries: 89, url: null, last_sync: "15 min ago", gaps: null, config: { auto_sync: true, frequency: "hourly" } },
    { id: "ks-6", tenant_id: "r-travel", name: "Cancellation Policy", type: "policy", status: "active", entries: 5, url: "https://rtravel.com/policies/cancellation", last_sync: "30 min ago", gaps: null, config: { auto_sync: true, frequency: "daily" } },
  ];

  for (const s of ksData) {
    await runQ(
      `INSERT OR IGNORE INTO knowledge_sources (id, tenant_id, name, type, status, entries, url, last_sync, gaps, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.tenant_id, s.name, s.type, s.status, s.entries, s.url, s.last_sync, s.gaps ? JSON.stringify(s.gaps) : null, s.config ? JSON.stringify(s.config) : null, now, now]
    );
  }

  // ── Knowledge Gaps ───────────────────────────────────────────────
  const kgData = [
    { id: "gap-1", tenant_id: "r-mobile", question: "How do I transfer my number to a new device?", frequency: 45, status: "open", suggested_answer: "Use the SIM transfer tool in Settings > Cellular.", source_ids: ["ks-1"] },
    { id: "gap-2", tenant_id: "ichiba", question: "How do I change my shipping address after ordering?", frequency: 38, status: "open", suggested_answer: "Contact support within 2 hours.", source_ids: ["ks-4"] },
    { id: "gap-3", tenant_id: "r-travel", question: "Can I add baggage after booking?", frequency: 29, status: "open", suggested_answer: "Yes, up to 24 hours before departure via Manage Booking.", source_ids: ["ks-5"] },
  ];

  for (const g of kgData) {
    await runQ(
      `INSERT OR IGNORE INTO knowledge_gaps (id, tenant_id, question, frequency, status, suggested_answer, source_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [g.id, g.tenant_id, g.question, g.frequency, g.status, g.suggested_answer, g.source_ids ? JSON.stringify(g.source_ids) : null, now]
    );
  }

  // ── Canned Responses (r-mobile) ──────────────────────────────────
  const cannedResponses = [
    {
      id: "cr-1",
      tenant_id: "r-mobile",
      title: "Greeting / Opening",
      content: "Hi there! Welcome to R-Mobile support. My name is Alex and I'm here to help you today. Could you please describe what you need assistance with?",
      category: "greeting",
      tags: JSON.stringify(["greeting", "opening", "welcome"]),
      shortcut: "/hi",
      created_by: "user-1",
    },
    {
      id: "cr-2",
      tenant_id: "r-mobile",
      title: "Looking Into That",
      content: "I completely understand your concern. Let me look into that for you right away — this will just take a moment.",
      category: "general",
      tags: JSON.stringify(["lookup", "investigating", "hold"]),
      shortcut: "/look",
      created_by: "user-1",
    },
    {
      id: "cr-3",
      tenant_id: "r-mobile",
      title: "Order / Account Tracking",
      content: "I've pulled up your account details. Your order is currently {{order_status}} and is expected to arrive by {{estimated_delivery}}. You can also track it in real-time at {{tracking_link}}.",
      category: "order",
      tags: JSON.stringify(["order", "tracking", "shipping", "delivery"]),
      shortcut: "/track",
      created_by: "user-1",
    },
    {
      id: "cr-4",
      tenant_id: "r-mobile",
      title: "Apology Template",
      content: "I sincerely apologize for the inconvenience this has caused you. This is certainly not the experience we want our customers to have. I'm going to make this right for you.",
      category: "general",
      tags: JSON.stringify(["apology", "sorry", "escalation"]),
      shortcut: "/sorry",
      created_by: "user-1",
    },
    {
      id: "cr-5",
      tenant_id: "r-mobile",
      title: "Closing / Farewell",
      content: "Thank you for contacting R-Mobile support! I'm glad I could help resolve your issue today. If you have any other questions in the future, please don't hesitate to reach out. Have a wonderful day!",
      category: "closing",
      tags: JSON.stringify(["closing", "farewell", "goodbye"]),
      shortcut: "/bye",
      created_by: "user-1",
    },
    {
      id: "cr-6",
      tenant_id: "r-mobile",
      title: "Escalation to Manager",
      content: "I understand your frustration, and I'd like to escalate this to my supervisor who has additional authority to help resolve this for you. Please allow me to transfer you — your wait time should be under 2 minutes.",
      category: "escalation",
      tags: JSON.stringify(["escalation", "manager", "supervisor", "transfer"]),
      shortcut: "/escalate",
      created_by: "user-1",
    },
  ];

  for (const cr of cannedResponses) {
    await runQ(
      `INSERT OR IGNORE INTO canned_responses (id, tenant_id, title, content, category, tags, shortcut, use_count, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cr.id, cr.tenant_id, cr.title, cr.content, cr.category, cr.tags, cr.shortcut, 0, cr.created_by, now, now]
    );
  }

  console.log("[seed] Database seeded");
}
