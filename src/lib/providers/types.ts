// ── Backend Provider Abstraction ────────────────────────────────────
//
// Sierra runs on a swappable "backend provider". Supabase, AWS, and GCP
// all expose a managed PostgreSQL database (Supabase Postgres, RDS/Aurora,
// Cloud SQL/AlloyDB) and a Redis-compatible cache (Upstash, ElastiCache,
// Memorystore). Because the database is Postgres in every case, the thing
// that actually changes between providers is *connection configuration*
// (host, SSL, connection pooler) and the cache endpoint — not the query
// dialect. This layer normalizes that configuration behind one interface
// so the rest of the app never hardcodes a provider.
//
// Select the active provider with the BACKEND_PROVIDER env var:
//   BACKEND_PROVIDER=supabase | aws | gcp | local | auto (default)

export type ProviderName = "supabase" | "aws" | "gcp" | "local";
export type ProviderSelector = ProviderName | "auto";

/** SSL mode for the Postgres connection. */
export type SslConfig = false | { rejectUnauthorized: boolean; ca?: string };

export interface DatabaseConfig {
  /** libpq connection string (postgresql://user:pass@host:port/db). */
  connectionString: string;
  /** SSL settings — managed providers require TLS; local usually does not. */
  ssl: SslConfig;
  /** Max pool connections. */
  poolMax: number;
  /**
   * When true, no reachable Postgres is expected and the engine should use
   * the embedded SQLite database (single-node local dev only).
   */
  preferSqlite: boolean;
}

export interface CacheConfig {
  /** "redis" for any Redis-protocol endpoint; "memory" for in-process LRU. */
  driver: "redis" | "memory";
  /** Full redis:// or rediss:// URL (preferred; used by Upstash/managed Redis). */
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  /** Use TLS (rediss://). Managed Redis usually requires this. */
  tls?: boolean;
}

export interface BackendConfig {
  /** What the user asked for (may be "auto"). */
  requested: ProviderSelector;
  /** What "auto" resolved to (or the explicit choice). */
  provider: ProviderName;
  database: DatabaseConfig;
  cache: CacheConfig;
}
