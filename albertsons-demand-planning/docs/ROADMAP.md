# Roadmap

The vertical slice in `main` proves the architecture. What follows is what we'd
build next, in priority order.

## Near term (next 6 weeks)

1. **Real data ingestion**. Adapter package that ETLs from a snapshot of POS
   data (CSV / Iceberg / Snowflake) into the `sales` parquet schema.
   Owns column mapping, currency normalization, and out-of-stock detection.
2. **Promo calendar source of truth**. Today `on_promo` is part of the sales
   table. In production it lives in a separate promo system that the science
   needs to *read forward* (to know about future promos). Wire a
   `promo_calendar` table and forward-facing features.
3. **Model registry**. Persist trained models with version, training window,
   metrics. `pipelines.forecast_batch` should resolve the model by registry,
   not the filesystem.
4. **Backtest dashboard**. The current `/accuracy` page shows aggregate WAPE.
   Add slicing by category, district, horizon-day, promo vs non-promo.
5. **Planner overrides**. The workbench can already accept/override orders;
   persist those overrides to Postgres and use them as training signal
   (with appropriate causal care — overrides are a treatment).

## Medium term (next quarter)

6. **Hierarchical reconciliation (MinT)**. Replace bottom-up with proper
   reconciliation. Especially valuable for store-cluster forecasts.
7. **Out-of-stock-aware training**. Mask training rows where availability was
   constrained; otherwise the model learns to under-forecast popular items
   when they sold out.
8. **Causal promo lift model**. Today promos are features. Move to a uplift
   model that estimates `lift = E[y | promo] - E[y | no_promo]` with proper
   confounding controls. Lets planners ask "what if".
9. **Production orchestration**. Airflow or Dagster DAG for the daily pipeline,
   with SLA monitoring and alerting on drift.
10. **Auth + RBAC**. Planners shouldn't see all districts; district managers
    shouldn't approve regional buys.

## Long term

11. **Multi-step optimization**. Today's replenishment is per-day, per-SKU.
    Real grocery ordering is constrained by truck capacity, supplier MOQs,
    and shelf space. Joint optimization across SKUs with constraints.
12. **Substitution + assortment**. When SKU A stocks out, B sells more. Model
    cross-elasticities and let assortment changes propagate into forecasts.
13. **New-item forecasting**. Cold-start for new SKUs using similar-item priors
    and assortment graph embeddings.
14. **Counterfactual evaluation**. A/B comparing recommendations vs planner
    overrides over a long enough window to detect drift in human policy.

## What we will *not* build

- A general-purpose forecasting platform. This product is opinionated about
  grocery, daily cadence, SKU×store granularity. That focus is a feature.
- Real-time inference. Demand planning is a batch problem.
- Our own gradient-boosting library. LightGBM is excellent and well-supported.
