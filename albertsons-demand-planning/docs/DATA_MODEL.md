# Data Model

All entities are stored as parquet under `infra/data/`. Schemas are enforced
by `adp_science.data.schema`.

## Hierarchies

```
Department  →  Category  →  Subcategory  →  SKU
Region      →  District  →  Store
```

Examples:
- Fresh → Bakery → Bread → SKU `BKR-001` (Sourdough Loaf 24oz)
- Region West → District Norcal → Store `S-104` (Albertsons #104, Berkeley)

## Tables

### `sales` (granular fact)

| column      | type   | notes                                   |
|-------------|--------|-----------------------------------------|
| date        | date   | calendar date                           |
| store_id    | string | FK → stores                             |
| sku_id      | string | FK → skus                               |
| units       | int    | units sold (>=0)                        |
| revenue     | float  | dollars                                 |
| price       | float  | per-unit shelf price on that day        |
| on_promo    | bool   | true if any promo active                |
| promo_depth | float  | discount fraction in [0, 1)             |

Grain: one row per (date, store, SKU). Zero rows are kept — they're signal.

Partitioned by `month(date)`.

### `skus`

| column        | type   | notes                              |
|---------------|--------|------------------------------------|
| sku_id        | string | PK                                 |
| name          | string |                                    |
| department    | string |                                    |
| category      | string |                                    |
| subcategory   | string |                                    |
| pack_size     | int    | inner pack qty                     |
| shelf_days    | int    | perishability cap; ∞ for ambient   |
| base_price    | float  | reference price                    |
| lead_time_days| int    | days from order to delivery        |

### `stores`

| column        | type   | notes              |
|---------------|--------|--------------------|
| store_id      | string | PK                 |
| name          | string |                    |
| district      | string |                    |
| region        | string |                    |
| size_tier     | string | S / M / L          |
| open_date     | date   |                    |

### `forecasts`

| column          | type   | notes                                |
|-----------------|--------|--------------------------------------|
| origin_date     | date   | day the forecast was made            |
| target_date     | date   | day being predicted                  |
| horizon_day     | int    | target_date - origin_date            |
| store_id        | string |                                      |
| sku_id          | string |                                      |
| y_p50           | float  | median point forecast                |
| y_p10           | float  | 80% interval lower                   |
| y_p90           | float  | 80% interval upper                   |
| y_p025          | float  | 95% interval lower                   |
| y_p975          | float  | 95% interval upper                   |
| model           | string | "ensemble" / "lgbm" / "baseline"     |

Grain: one row per (origin_date, target_date, store, SKU).

### `recommendations`

| column         | type   | notes                                  |
|----------------|--------|----------------------------------------|
| order_date     | date   | when the order is placed               |
| arrival_date   | date   | order_date + lead_time                 |
| store_id       | string |                                        |
| sku_id         | string |                                        |
| on_hand        | int    | assumed/observed inventory             |
| suggested_qty  | int    |                                        |
| service_level  | float  | target (e.g. 0.95)                     |
| reason         | string | human-readable rationale               |

### `accuracy` (denormalized backtest output)

| column      | type   | notes                                |
|-------------|--------|--------------------------------------|
| origin_date | date   |                                      |
| target_date | date   |                                      |
| store_id    | string |                                      |
| sku_id      | string |                                      |
| y           | float  | actual                               |
| y_hat       | float  | point forecast                       |
| ape         | float  | abs(y - y_hat) / max(y, 1e-6)        |
| ae          | float  | abs(y - y_hat)                       |
| model       | string |                                      |

The API computes WAPE/bias from this on demand by group.

## Notes

- All `date` values are stored as `pyarrow.date32` (no time component).
- All identifiers are short strings (`S-104`, `BKR-001`) for human readability.
- We deliberately keep historical zeros and historical out-of-stock rows
  separate (the latter would need an `availability` table, in scope of the
  roadmap, not the slice).
