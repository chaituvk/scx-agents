# Albertsons Intelligence — Demand Planning

A full-stack demand planning product for grocery retail. Forecasts SKU-level demand
across stores, generates replenishment recommendations, and gives planners a
workbench to review and act on the recommendations.

## What's in the box

```
albertsons-demand-planning/
├── packages/science/   Python science package: forecasting + optimization
├── apps/api/           FastAPI backend serving forecasts + recommendations
├── apps/web/           Next.js planner dashboard
├── docs/               Architecture, data model, science deep-dives
└── infra/              Compose file, generated data, notebooks
```

Three independently runnable layers. `packages/science` is the heart of the
"intelligence" — everything else is a thin wrapper around it.

## The 5-minute tour

```bash
# 1. Install the science package and generate two years of synthetic data
make science-install
make data

# 2. Train models and produce a forecast horizon
make train
make forecast

# 3. Start the API + dashboard
make api      # http://localhost:8000/docs
make web      # http://localhost:3000
```

End-to-end, you'll see real forecasts with prediction intervals, backtested
accuracy by category and store, and a replenishment workbench with order
suggestions a planner can approve or override.

## Why this exists

Grocery demand planning is a hard problem with a clear shape:

- **Intermittent, fat-tailed demand** — most SKU/store/day cells sell 0 or 1 units
- **Strong calendars** — day-of-week, holidays, paydays, school calendars
- **Promo + price elasticity** — a 20% TPR can 3x velocity; the model must learn this
- **Perishability** — over-ordering produces waste, under-ordering produces lost sales
- **Hierarchical structure** — SKUs roll up to categories and departments;
  stores roll up to districts and regions. Forecasts at every level should agree.

This product addresses all of these with a layered approach: classical
statistical baselines, gradient-boosted regression with calendar + lag + promo
features, quantile forecasts for safety stock, and a reconciliation step to
keep the hierarchy consistent.

See [docs/SCIENCE.md](docs/SCIENCE.md) for the modeling deep-dive and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## Status

This is a working vertical slice — synthetic data, a real model, real
optimization, a real API, a real dashboard. It is **not** wired to live
Albertsons data, and the model surface is deliberately small (one gradient-
boosted regressor + a seasonal-naive baseline + an ensemble). Roadmap for
production hardening lives in [docs/ROADMAP.md](docs/ROADMAP.md).
