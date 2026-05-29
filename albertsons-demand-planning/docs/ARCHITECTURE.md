# Architecture

## System shape

```
                    ┌──────────────────────────────┐
                    │   Planner Dashboard (Next.js)│
                    │   apps/web                   │
                    └───────────────┬──────────────┘
                                    │ HTTP / JSON
                    ┌───────────────▼──────────────┐
                    │   Forecast API  (FastAPI)    │
                    │   apps/api                   │
                    └───────────────┬──────────────┘
                                    │ reads parquet
                    ┌───────────────▼──────────────┐
                    │   Forecast Store (parquet)   │
                    │   infra/data/forecasts/      │
                    └───────────────▲──────────────┘
                                    │ writes parquet
                    ┌───────────────┴──────────────┐
                    │  Science Package (Python)    │
                    │  packages/science            │
                    │  - synthetic data generator  │
                    │  - feature engineering       │
                    │  - forecasting models        │
                    │  - backtest + metrics        │
                    │  - replenishment optimizer   │
                    └──────────────────────────────┘
```

## Three layers, on purpose

### 1. Science (`packages/science`)

A pure Python library. No web framework, no I/O beyond parquet/CSV. Everything
the model needs is a function call. This is the **only** layer where
forecasting and optimization logic lives.

Pipelines (`adp_science.pipelines.*`) are thin CLIs that compose the library
into batch jobs: generate data, train, score, optimize. They write parquet
artifacts to `infra/data/`.

Why a library, not a service: forecasting is a batch problem. Real-time
inference is the wrong shape — you can't compute a 28-day horizon on demand.
You compute it once a day, store it, and serve from the store. Decoupling the
science from the API also lets data scientists iterate in notebooks against the
same code that runs in production.

### 2. API (`apps/api`)

A FastAPI service. Loads parquet artifacts at startup, serves them over JSON.
Stateless — no DB, no auth (yet). Read-only endpoints for forecasts,
recommendations, accuracy metrics; write endpoints for planner overrides.

The API is intentionally dumb. It doesn't compute forecasts. It serves
pre-computed ones, with a small projection/aggregation layer. This is the
right factoring for a forecasting product: the model owns the math, the API
owns the contract.

### 3. Web (`apps/web`)

Next.js 16 App Router. Server components for data fetching, client components
for charts (recharts). Three primary surfaces:

- **Home** — KPIs (WAPE, in-stock %, forecast bias, lost-sales risk)
- **Forecast explorer** — pick a store + SKU, see history + forecast + 80%/95%
  prediction intervals
- **Replenishment workbench** — list of order recommendations grouped by store,
  with rationale and accept/override actions

## Data flow

Daily batch:

1. `pipelines.generate_data` — synthetic POS extract → `data/raw/sales.parquet`
2. `pipelines.train` — fits models per category, persists to `data/models/`
3. `pipelines.forecast_batch` — produces 28-day horizon → `data/forecasts/horizon.parquet`
4. `pipelines.replenish` — applies safety stock + lead time → `data/recommendations/orders.parquet`
5. API restarts (or hot-reloads) and serves the new artifacts.

In production this is orchestrated by Airflow / Prefect / Dagster — out of
scope for this slice.

## Why parquet, not a database

This product is read-mostly with a daily write pattern. Parquet is:

- columnar, so the API's typical query (one store × one SKU × N days) is fast
- partitioned by date, so we can ship a new forecast without touching the old one
- portable, so the same artifacts run locally, in S3, or in a warehouse

When we need write paths (planner overrides, order placement), those go to a
real OLTP DB (Postgres). The forecast store stays read-only.

## Domain model

See [DATA_MODEL.md](DATA_MODEL.md) for entity definitions. The short version:

- **SKU** — an item; belongs to a `subcategory` → `category` → `department`
- **Store** — a physical location; belongs to a `district` → `region`
- **Sale** — `(date, store_id, sku_id) → units, price, on_promo`
- **Forecast** — `(date, store_id, sku_id, horizon_day) → p50, p80_lo, p80_hi, p95_lo, p95_hi`
- **Recommendation** — `(store_id, sku_id, order_date) → suggested_qty, rationale`

## Tech choices and tradeoffs

| Choice | Why | Tradeoff |
|---|---|---|
| LightGBM + statistical baseline | Strong on tabular retail data with mixed signal types | Less rich than DL for very long horizons or huge SKU counts |
| Quantile regression | Direct prediction intervals without distributional assumptions | More expensive than point forecast + bootstrap |
| Parquet as the forecast store | Fast columnar reads, no infra, easy to partition | No write path, no transactions |
| FastAPI | Pydantic schemas align with science contracts; async serving | Python deploy story is heavier than Go/Node |
| Next.js App Router | RSC keeps the planner UI snappy on slow networks | Steeper learning curve than a SPA |

## Not in scope (yet)

- Real-time ingestion / streaming
- Auth, multi-tenancy, RBAC
- Hyperparameter tuning / experiment tracking (MLflow/W&B)
- Model registry and shadow/champion routing
- Production orchestration (Airflow/Prefect)
- Notification/alerting on forecast drift

These are real, and all addressed in [ROADMAP.md](ROADMAP.md).
