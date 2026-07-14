# Deploying Sierra on Supabase

Supabase is the managed **backend** (Postgres + pgvector). The Next.js app
runs on any container host or Vercel and points at it via
`BACKEND_PROVIDER=supabase`. This guide takes you from an empty Supabase
project to a running, seeded deployment.

## 0. Prerequisites

- A Supabase project (Dashboard → New project). Note the **project ref**.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (optional but
  recommended), or just the SQL editor.
- A strong `JWT_SECRET`: `openssl rand -base64 48`.

## 1. Apply the schema

The full schema lives in `supabase/migrations/0001_initial_schema.sql`
(idempotent; enables `pgvector` first).

**With the CLI:**
```bash
supabase link --project-ref <your-ref>
supabase db push
```

**Without the CLI:** paste the contents of the migration file into the
Supabase SQL editor and run it.

## 2. Seed the demo tenants (optional)

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
# or paste supabase/seed.sql into the SQL editor
```

This creates the three demo tenants only — **no** user accounts.

## 3. Create the first admin (real password, no hardcoded creds)

```bash
SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres' \
SEED_ADMIN_EMAIL='admin@yourco.com' \
SEED_ADMIN_PASSWORD='<a strong password>' \
node scripts/bootstrap-admin.mjs
```

Idempotent — re-run to rotate the password. Never enable `SEED_ON_BOOT` in
production (that path provisions a *well-known* demo admin).

## 4. Configure the app environment

Get the connection string from **Dashboard → Settings → Database →
Connection string → URI**. Prefer the **Transaction pooler (port 6543)** for
serverless/Vercel; the direct connection (5432) is fine for a long-lived
container.

```bash
BACKEND_PROVIDER=supabase
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres
JWT_SECRET=<openssl rand -base64 48>
SEED_ON_BOOT=0
# Optional shared cache (Supabase has no managed Redis) — otherwise the app
# uses an in-process cache (fine for a single instance):
# REDIS_URL=rediss://default:[TOKEN]@[endpoint].upstash.io:6379
# At least one LLM provider for llm/hybrid journeys:
# OPENAI_API_KEY=sk-...
```

TLS is on by default for the `supabase` provider. For strict certificate
verification, set `DB_SSL=strict` and provide `DB_CA_CERT`.

## 5. Deploy the app

**Vercel** (app + Supabase is the common combo):
1. Import the repo. Framework preset: Next.js (no build overrides needed).
2. Add the env vars from step 4 in **Project → Settings → Environment
   Variables**. Use the **pooler** URL (6543).
3. Deploy. `better-sqlite3` and `pg` are marked `serverExternalPackages`, so
   the native SQLite addon is not bundled.

**Docker / any container host** (ECS, Cloud Run, Fly, a VM):
```bash
docker build -t sierra-app .
docker run -p 3000:3000 --env-file .env.production sierra-app
```

## 6. Verify

```bash
curl https://<your-app>/api/health
# { "status":"ok", "provider":"supabase",
#   "database":{ "engine":"postgres", "reachable":true }, ... }
```

Then log in at `/login` with the admin from step 3.

---

## Production checklist

- [ ] Migration applied (`0001_initial_schema.sql`).
- [ ] `JWT_SECRET` set to a strong random value — the app **refuses to boot**
      in production without it.
- [ ] `SEED_ON_BOOT` unset/`0`; admin created via `bootstrap-admin.mjs`.
- [ ] `BACKEND_PROVIDER=supabase` and `SUPABASE_DB_URL` point at the pooler.
- [ ] `/api/health` returns 200 with `provider: "supabase"`.
- [ ] (Multi-instance) shared `REDIS_URL` configured.
- [ ] Review still-open security items in the repo before exposing publicly
      (see the code review notes on tenant-scoping the `[id]` routes).
