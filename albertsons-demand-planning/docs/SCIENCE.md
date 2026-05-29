# Science

This document explains the forecasting and optimization approach. It is the
reference for anyone iterating on `packages/science`.

## The problem

For every (store, SKU, date) cell, predict units sold for the next
`H` days, along with prediction intervals at 80% and 95% coverage. Use those
forecasts to recommend replenishment orders that minimize the joint cost of
stock-outs and waste.

Grocery demand has a particular shape:

- **Intermittent**: ~60–80% of SKU×store×day cells are zero at the long tail
- **Fat tails**: the rare non-zero days can be 10× the mean
- **Strong calendar**: day-of-week effects of 2–3×, holiday effects of 5–10×
- **Promo lifts**: TPR (temporary price reduction) of 20% drives lifts of 2–5×
- **Substitution**: when SKU A is out, B sells more — we ignore this in the slice

## Models

We use a small ensemble:

### Baseline: seasonal naive

`y_hat_{t+h} = y_{t+h - 7}` — same day of week, one week ago, smoothed with a
small rolling mean. Crucial for two reasons:

1. It's a hard-to-beat floor on most SKUs.
2. It catches structural breaks (a SKU that just started selling) that the ML
   model can't see until it has lag history.

### Primary: LightGBM gradient boosting

A single regressor trained per `category` on a long-format panel:

```
features:
  - calendar: dow, doy, week, month, is_weekend, is_holiday, days_to_holiday
  - lags: y_lag_7, y_lag_14, y_lag_28
  - rolling: y_rmean_7, y_rmean_28, y_rstd_28
  - promo: on_promo, promo_depth, days_in_promo
  - price: price, price_rel_28d (relative to recent average)
  - hierarchy: store_id, sku_id, subcategory  (as categorical)
target:
  - y (units sold)
```

We fit three quantile heads (`alpha=0.1, 0.5, 0.9`) using LightGBM's quantile
objective. The 80% interval comes from the 0.1 and 0.9 quantiles; the 95%
interval is bootstrap-extrapolated from the residuals (see `evaluate/intervals.py`).

Why per-category models: behavior across departments is wildly different.
Bakery is highly perishable and DOW-driven; ambient is smooth and promo-driven.
A single global model averages these signals away. Per-category is the
sweet-spot between per-SKU (too few samples) and global (too coarse).

### Ensemble

```
y_hat = w_baseline * y_baseline + (1 - w_baseline) * y_lgbm
```

`w_baseline` is fit per (category, horizon_day) on a holdout window by
minimizing pinball loss. New SKUs (cold-start) fall back to `w_baseline = 1`.

## Feature engineering, with care

Two failure modes are common in retail forecasting:

1. **Target leakage via lags**: `y_lag_7` at `t` is `y_{t-7}`. When you forecast
   `t+5`, the lag is `y_{t-2}` — fine for the first horizon, but for `t+14`
   the relevant lag is `y_{t+7}`, which is in the future. We handle this by
   computing features **at forecast origin** and using *only* lags that are
   strictly older than `t - h + 1`.
2. **Promo features that look ahead**: `is_promo_next_week` is allowed because
   promo calendars are known in advance. `units_sold_next_week` is not. We
   classify each feature explicitly in `features/pipeline.py`.

The feature builder enforces both invariants programmatically.

## Backtesting

We use **rolling-origin** backtests. Given a dataset ending at `T`, we
evaluate at origins `{T - 90, T - 60, T - 30}`, each forecasting a 28-day
horizon, scoring on the actual observed values.

Single-window holdout is misleading for retail because seasonality dominates.
Rolling origin gives us a distribution of accuracy across calendar conditions.

## Metrics

We report:

- **WAPE** (Weighted Absolute Percentage Error) — primary KPI. Robust to zeros
  (which kill MAPE) and aggregates cleanly across hierarchies.
- **Bias** — `sum(y_hat - y) / sum(y)`. Positive = over-forecast. Critical for
  perishables.
- **Pinball loss** — for quantile heads. Lower = better-calibrated intervals.
- **In-stock coverage** — proxy for service level, computed from
  `Pr(demand <= recommended_order)` over the simulated lead time.

We do **not** report MAPE as a primary metric. With intermittent demand,
MAPE either blows up (zero actuals) or under-rewards good intermittent
forecasts.

## Replenishment optimization

Given a forecast distribution over the lead time + review period, the
order-up-to level is:

```
S = mu_LT+R + z_alpha * sigma_LT+R
order_qty = max(0, S - on_hand - on_order)
```

where `alpha` is the target service level (default 95%) and
`(mu, sigma)_LT+R` is derived from the forecast quantiles via a Gaussian-fit
approximation (see `optimize/safety_stock.py`).

This is the standard `(s, S)` policy. It's well-suited to a daily review
cycle and stationary lead times. For perishable categories we cap `S` at a
`max_shelf_days` parameter to bound waste.

## Hierarchical reconciliation (sketch)

Forecasts at SKU × store level should be consistent with category × district
totals. We use a simple bottom-up reconciliation: aggregate SKU×store forecasts
to the higher levels and report both. A full MinT reconciliation is in the
roadmap but adds complexity disproportionate to a vertical slice.

## What we deliberately don't do

- **Deep learning (N-BEATS, TFT, etc.)**: retail panels are usually too short
  and too noisy to justify the engineering cost. LightGBM with thoughtful
  features beats most DL models on these problems.
- **Per-SKU models**: too few samples per long-tail SKU.
- **Real-time forecasting**: batch is the right cadence for demand planning.
- **Causal lift modeling for promos**: real, valuable, out of scope.

## Where to look in the code

| Concept | File |
|---|---|
| Synthetic data generation | `adp_science/data/synthetic.py` |
| Feature engineering | `adp_science/features/pipeline.py` |
| LightGBM model | `adp_science/forecast/lgbm.py` |
| Baseline | `adp_science/forecast/baseline.py` |
| Ensemble | `adp_science/forecast/ensemble.py` |
| Backtest harness | `adp_science/evaluate/backtest.py` |
| Metrics | `adp_science/evaluate/metrics.py` |
| Safety stock | `adp_science/optimize/safety_stock.py` |
| Replenishment policy | `adp_science/optimize/replenishment.py` |
