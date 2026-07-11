import type {
  BackendConfig,
  CacheConfig,
  DatabaseConfig,
  ProviderName,
  ProviderSelector,
  SslConfig,
} from "./types";

// ── Provider Configuration Resolver ─────────────────────────────────
//
// Reads environment variables and produces a normalized BackendConfig for
// the active provider. This is the single place that knows the differences
// between Supabase, AWS, GCP, and local — everything downstream (db.ts,
// cache.ts) is provider-agnostic.

function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function poolMax(): number {
  const raw = process.env.DB_POOL_MAX;
  if (!raw) return 50;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

/**
 * SSL for managed Postgres. Defaults to TLS with server-cert verification
 * relaxed (`rejectUnauthorized: false`), which is what Supabase / RDS /
 * Cloud SQL public endpoints need out of the box. Tighten with:
 *   DB_SSL=strict         → verify the chain
 *   DB_CA_CERT=<pem>      → pin a CA (also implies verification)
 *   DB_SSL=disable        → no TLS (local only)
 */
function managedSsl(): SslConfig {
  const mode = (process.env.DB_SSL || "").toLowerCase();
  if (mode === "disable" || mode === "off" || mode === "false") return false;
  const ca = process.env.DB_CA_CERT;
  if (ca) return { rejectUnauthorized: true, ca };
  if (mode === "strict") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

/** Resolve "auto" to a concrete provider by sniffing which env vars exist. */
function resolveProvider(requested: ProviderSelector): ProviderName {
  if (requested !== "auto") return requested;
  if (firstEnv("SUPABASE_DB_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")) {
    return "supabase";
  }
  if (firstEnv("AWS_RDS_URL", "AWS_EXECUTION_ENV")) return "aws";
  if (firstEnv("GCP_SQL_URL", "CLOUD_SQL_CONNECTION_NAME", "K_SERVICE")) {
    return "gcp";
  }
  return "local";
}

function readSelector(): ProviderSelector {
  const raw = (process.env.BACKEND_PROVIDER || "auto").toLowerCase();
  if (
    raw === "supabase" ||
    raw === "aws" ||
    raw === "gcp" ||
    raw === "local" ||
    raw === "auto"
  ) {
    return raw;
  }
  console.warn(`[providers] Unknown BACKEND_PROVIDER "${raw}", falling back to "auto"`);
  return "auto";
}

// ── Per-provider database resolution ────────────────────────────────

function databaseFor(provider: ProviderName): DatabaseConfig {
  switch (provider) {
    case "supabase": {
      // Supabase gives a Postgres connection string. Prefer the pooled
      // "Transaction" connection (port 6543) for serverless; the direct
      // connection (5432) also works. Either can be passed verbatim.
      const url = firstEnv("SUPABASE_DB_URL", "DATABASE_URL");
      if (!url) {
        throw new Error(
          "[providers] BACKEND_PROVIDER=supabase but SUPABASE_DB_URL (or DATABASE_URL) is not set"
        );
      }
      return { connectionString: url, ssl: managedSsl(), poolMax: poolMax(), preferSqlite: false };
    }
    case "aws": {
      const url = firstEnv("AWS_RDS_URL", "DATABASE_URL");
      if (!url) {
        throw new Error(
          "[providers] BACKEND_PROVIDER=aws but AWS_RDS_URL (or DATABASE_URL) is not set"
        );
      }
      return { connectionString: url, ssl: managedSsl(), poolMax: poolMax(), preferSqlite: false };
    }
    case "gcp": {
      // Cloud SQL: either a TCP URL (public IP / Auth Proxy) via GCP_SQL_URL,
      // or a unix-socket path via the Cloud SQL connector. Both are encoded
      // in a standard connection string.
      const url = firstEnv("GCP_SQL_URL", "DATABASE_URL");
      if (!url) {
        throw new Error(
          "[providers] BACKEND_PROVIDER=gcp but GCP_SQL_URL (or DATABASE_URL) is not set"
        );
      }
      // Unix-socket connections (host=/cloudsql/...) must not use TLS.
      const ssl = url.includes("/cloudsql/") ? false : managedSsl();
      return { connectionString: url, ssl, poolMax: poolMax(), preferSqlite: false };
    }
    case "local":
    default: {
      const url = firstEnv("DATABASE_URL");
      // No DATABASE_URL and USE_SQLITE explicitly requested → embedded SQLite.
      const preferSqlite = !url && /^(1|true|yes)$/i.test(process.env.USE_SQLITE || "");
      return {
        connectionString: url || "postgresql://sierra:sierra2026@localhost:5432/sierra",
        ssl: /^(1|true|require|strict)$/i.test(process.env.DB_SSL || "") ? managedSsl() : false,
        poolMax: poolMax(),
        preferSqlite,
      };
    }
  }
}

// ── Cache resolution (Redis-protocol everywhere, or in-process memory) ──

function cacheFor(provider: ProviderName): CacheConfig {
  // A full URL always wins and covers Upstash / ElastiCache / Memorystore.
  const url = firstEnv("REDIS_URL", "CACHE_URL");
  if (url) {
    return { driver: "redis", url, tls: url.startsWith("rediss://") };
  }

  const host = firstEnv("REDIS_HOST");
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  const password = firstEnv("REDIS_PASSWORD");

  // Managed providers without an explicit endpoint fall back to memory so
  // the app still boots (single-node) instead of hanging on a missing Redis.
  if (!host && provider !== "local") {
    return { driver: "memory" };
  }

  if (!host) {
    // Local default. Matches docker-compose (redis mapped to 6379).
    return { driver: "redis", host: "127.0.0.1", port: port ?? 6379, password };
  }

  return {
    driver: "redis",
    host,
    port: port ?? 6379,
    password,
    tls: /^(1|true|yes)$/i.test(process.env.REDIS_TLS || ""),
  };
}

let cached: BackendConfig | null = null;

/** Resolve (and memoize) the active backend configuration. */
export function getBackendConfig(): BackendConfig {
  if (cached) return cached;
  const requested = readSelector();
  const provider = resolveProvider(requested);
  cached = {
    requested,
    provider,
    database: databaseFor(provider),
    cache: cacheFor(provider),
  };
  return cached;
}

/** Non-secret summary for health checks / logs. Never leaks the password. */
export function describeBackend(): {
  requested: ProviderSelector;
  provider: ProviderName;
  database: { engine: "postgres" | "sqlite"; ssl: boolean; host: string };
  cache: { driver: string; endpoint: string };
} {
  const c = getBackendConfig();
  let host = "unknown";
  try {
    if (!c.database.preferSqlite) host = new URL(c.database.connectionString).host || "unknown";
  } catch {
    /* connection string may be a unix socket; keep "unknown" */
  }
  const cacheEndpoint = c.cache.url
    ? new URL(c.cache.url).host
    : c.cache.host
      ? `${c.cache.host}:${c.cache.port}`
      : "memory";
  return {
    requested: c.requested,
    provider: c.provider,
    database: {
      engine: c.database.preferSqlite ? "sqlite" : "postgres",
      ssl: c.database.ssl !== false,
      host: c.database.preferSqlite ? "local-file" : host,
    },
    cache: { driver: c.cache.driver, endpoint: cacheEndpoint },
  };
}
