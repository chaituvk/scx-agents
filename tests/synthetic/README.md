# Synthetic Test Data

A deterministic, dependency-free generator for realistic Sierra data —
tenant-scoped conversations, message threads, daily insights, and flagged
conversations that match the DB schema in `src/lib/db.ts`.

Use it to populate dashboards, exercise multi-tenant isolation, load-test the
data layer, or seed a Supabase/AWS/GCP database for a demo.

## Quick start

```bash
# Generate JSON fixtures into tests/synthetic/data/ (defaults: 50/tenant, seed 1337)
node tests/synthetic/generate.js

# Larger volume + a reproducible seed
node tests/synthetic/generate.js --conversations 500 --seed 42

# Also emit a seed.sql for loading into Postgres/Supabase
node tests/synthetic/generate.js --conversations 200 --sql

# Validate the generator (integrity, tenant isolation, determinism)
node tests/synthetic/dataset.test.js
```

## Options

| Flag              | Default            | Meaning                                   |
| ----------------- | ------------------ | ----------------------------------------- |
| `--conversations` | `50`               | Conversations **per tenant**              |
| `--seed`          | `1337`             | RNG seed — same seed ⇒ identical output   |
| `--tenants`       | all three          | Comma list, e.g. `r-mobile,ichiba`        |
| `--out`           | `./data`           | Output directory                          |
| `--sql`           | off                | Also write `seed.sql`                     |

## Output layout

```
data/
├── dataset.json          # everything, in one file
├── summary.json          # seed, config, row-count totals
├── seed.sql              # (with --sql) INSERT ... ON CONFLICT DO NOTHING
└── <tenant>/
    ├── conversations.json
    ├── messages.json
    ├── insights.json
    └── flagged.json
```

The `data/` directory is git-ignored — it is fully reproducible from the
generator, which is the source of truth.

## Guarantees

- **Deterministic** — a given `(seed, conversations, tenants)` always produces
  byte-identical output. Reproducible tests can rely on it.
- **Schema-accurate** — columns and enums (`status`, `sentiment`, `role`,
  `severity`, metrics) match `src/lib/db.ts`.
- **Referentially sound** — every message/flag points at a real conversation;
  every row's `tenant_id` matches its conversation. `dataset.test.js` asserts
  all of this.
- **Domain-flavored** — R-Mobile (telecom), Ichiba (e-commerce), and RTravel
  (travel) get topic-appropriate customer messages.

## Loading the data

**Into Postgres / Supabase** (matches the `BACKEND_PROVIDER` work):

```bash
node tests/synthetic/generate.js --conversations 200 --sql
psql "$SUPABASE_DB_URL" -f tests/synthetic/data/seed.sql
```

**Programmatically** (mocks, other tests):

```js
const { generate } = require("./tests/synthetic/generate");
const dataset = generate({ conversationsPerTenant: 100, seed: 7 });
// dataset.tenants["ichiba"].conversations, .messages, .insights, .flagged
```

> The generated conversations use synthetic customers and `@example.com`-style
> addresses — no real PII.
