# Deployment & Backend Providers

Sierra runs on a **swappable backend provider**. Supabase, AWS, and GCP all
expose a managed PostgreSQL database and a Redis-compatible cache, so the app
targets one interface and you pick the provider with a single environment
variable.

```
BACKEND_PROVIDER = local | supabase | aws | gcp | auto
```

Because the database is Postgres in every case, switching providers is a
**configuration change, not a code change**. The provider layer
(`src/lib/providers/`) normalizes connection details (host, SSL, connection
pooler, cache endpoint); `src/lib/db.ts` and `src/lib/cache.ts` consume that
config and never hardcode a provider.

Check the live selection any time:

```bash
curl http://localhost:3000/api/health
# { "status":"ok", "provider":"supabase", "database":{...}, "cache":{...} }
```

---

## How selection works

| `BACKEND_PROVIDER` | Database source (in priority order)      | SSL default        | Cache source |
| ------------------ | ---------------------------------------- | ------------------ | ------------ |
| `local`            | `DATABASE_URL` → docker default → SQLite | off                | `REDIS_URL` / `REDIS_HOST`+`REDIS_PORT` |
| `supabase`         | `SUPABASE_DB_URL` → `DATABASE_URL`       | on (relaxed)       | `REDIS_URL` → memory |
| `aws`              | `AWS_RDS_URL` → `DATABASE_URL`           | on (relaxed)       | `REDIS_URL` → memory |
| `gcp`              | `GCP_SQL_URL` → `DATABASE_URL`           | on (off for socket)| `REDIS_URL` / `REDIS_HOST` → memory |
| `auto` (default)   | inferred from which provider vars exist  | per resolved       | per resolved |

TLS knobs (all managed providers): `DB_SSL=strict` to verify the chain,
`DB_CA_CERT=<pem>` to pin a CA, `DB_SSL=disable` for none. Pool size:
`DB_POOL_MAX` (default 50).

Managed providers with **no** Redis endpoint configured fall back to the
in-process LRU cache so the app still boots (single-node). Configure a shared
Redis (`REDIS_URL`) before scaling to more than one instance.

---

## Local development

```bash
./scripts/setup-infra.sh        # starts Postgres (pgvector) + Redis in Docker
npm install
npm run dev                     # http://localhost:3000
```

Or run the whole stack in containers:

```bash
docker compose --profile app up --build
```

No Postgres available? Set `USE_SQLITE=1` (with `BACKEND_PROVIDER=local`) to
use the embedded SQLite database.

---

## Supabase

1. Create a project. **Settings → Database → Connection string → URI.**
   Prefer the **Transaction pooler** (port `6543`) for serverless/edge; the
   direct connection (`5432`) is fine for a long-lived container.
2. Enable the `vector` extension (**Database → Extensions → `vector`**) if you
   plan to use pgvector RAG. The schema also creates it on boot if permitted.
3. Set env:

   ```bash
   BACKEND_PROVIDER=supabase
   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   JWT_SECRET=<openssl rand -base64 48>
   # Optional shared cache (Supabase has no managed Redis):
   REDIS_URL=rediss://default:[TOKEN]@[endpoint].upstash.io:6379
   ```

4. First deploy only — create the demo tenants + admin by running once with
   `SEED_ON_BOOT=1`, then **turn it off**. Do not leave seeding enabled in
   production (it provisions a well-known admin login).

The app + Supabase is host-agnostic: run the Docker image on any container
host, or deploy the Next.js app to Vercel and point it at `SUPABASE_DB_URL`.

---

## AWS (RDS/Aurora + ElastiCache)

```bash
BACKEND_PROVIDER=aws
AWS_RDS_URL=postgresql://user:pass@db.xxxx.us-east-1.rds.amazonaws.com:5432/sierra
REDIS_URL=rediss://cluster.xxxx.cache.amazonaws.com:6379
JWT_SECRET=...
```

Build the image and run it on ECS/Fargate (or EC2). Point the ALB health
check at `/api/health`. Ensure the RDS security group allows the task's
subnet; pin the RDS CA with `DB_CA_CERT` + `DB_SSL=strict` for full
verification.

## GCP (Cloud SQL/AlloyDB + Memorystore)

```bash
BACKEND_PROVIDER=gcp
# TCP (public IP / Auth Proxy):
GCP_SQL_URL=postgresql://user:pass@10.x.x.x:5432/sierra
# …or unix socket on Cloud Run (TLS auto-disabled):
# GCP_SQL_URL=postgresql://user:pass@/sierra?host=/cloudsql/PROJECT:REGION:INSTANCE
REDIS_HOST=10.x.x.x
JWT_SECRET=...
```

Deploy the container to Cloud Run with the Cloud SQL connection attached;
Cloud Run's health check hits `/api/health`.

---

## Docker image

`Dockerfile` produces a slim standalone image (`output: "standalone"` in
`next.config.ts`):

```bash
docker build -t sierra-app .
docker run -p 3000:3000 --env-file .env.local sierra-app
```

The image bundles only the traced server + static assets and runs as a
non-root user. `/app/data` is writable for the SQLite fallback (unused with a
managed provider).

---

## Production checklist

- [ ] `JWT_SECRET` set to a strong random value (never the committed default).
- [ ] `SEED_ON_BOOT` unset/`0` — seed once, then disable.
- [ ] `BACKEND_PROVIDER` set explicitly (not relying on `auto`).
- [ ] `DB_SSL=strict` + `DB_CA_CERT` for verified TLS to managed Postgres.
- [ ] Shared `REDIS_URL` configured if running more than one instance.
- [ ] Health check wired to `/api/health` (returns 503 when the DB is down).
