"""Per-day replenishment recommendation.

Given a forecast horizon and inventory state, produce a single order quantity
for each (store, SKU) using the order-up-to policy from `safety_stock`.

Rationale strings are part of the contract: planners want to see why an order
is being suggested, not just the number.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .safety_stock import StockParams, order_up_to


@dataclass(frozen=True)
class OrderInputs:
    on_hand: int
    on_order: int = 0


def recommend_one(
    *,
    forecast: pd.DataFrame,
    inputs: OrderInputs,
    params: StockParams,
) -> dict:
    """Compute a single order recommendation.

    `forecast` is a DataFrame for one (store, SKU) with columns
    `target_date, horizon_day, q0.10, q0.50, q0.90`, sorted by horizon_day.
    """
    f = forecast.sort_values("horizon_day")
    p10 = f["q0.10"].to_numpy()
    p50 = f["q0.50"].to_numpy()
    p90 = f["q0.90"].to_numpy()
    mu, sigma, S = order_up_to(p10, p50, p90, params)
    raw_qty = max(0.0, S - inputs.on_hand - inputs.on_order)
    qty = int(math.ceil(raw_qty))

    # Rationale: expose the components so a planner can sanity-check.
    cov_days = inputs.on_hand / max(p50.mean(), 1e-6)
    reason = (
        f"LT+R demand mu={mu:.1f}, sigma={sigma:.1f}, S={S:.1f}; "
        f"on_hand={inputs.on_hand} (~{cov_days:.1f}d cover); "
        f"service level={params.service_level:.0%}"
    )
    return {
        "suggested_qty": qty,
        "mu": mu,
        "sigma": sigma,
        "order_up_to": S,
        "reason": reason,
    }


def recommend_batch(
    forecasts: pd.DataFrame,
    skus: pd.DataFrame,
    *,
    order_date: pd.Timestamp,
    on_hand_by_pair: dict[tuple[str, str], int] | None = None,
    service_level: float = 0.95,
) -> pd.DataFrame:
    """Compute one recommendation per (store, SKU) for `order_date`.

    `forecasts` should already be the latest-origin forecasts (one row per
    target_date per pair). Lead-time and shelf-days are read from `skus`.
    """
    on_hand_by_pair = on_hand_by_pair or {}
    sku_meta = skus.set_index("sku_id")[["lead_time_days", "shelf_days"]].to_dict("index")

    rows = []
    for (store_id, sku_id), sub in forecasts.groupby(["store_id", "sku_id"], sort=False):
        meta = sku_meta.get(sku_id)
        if meta is None:
            continue
        lead = int(meta["lead_time_days"])
        shelf = int(meta["shelf_days"]) if meta["shelf_days"] < 9999 else None
        params = StockParams(
            lead_time_days=lead,
            review_days=1,
            service_level=service_level,
            max_shelf_days=shelf,
        )
        on_hand = int(on_hand_by_pair.get((store_id, sku_id), 0))
        try:
            rec = recommend_one(
                forecast=sub,
                inputs=OrderInputs(on_hand=on_hand),
                params=params,
            )
        except ValueError:
            # Forecast horizon too short - skip rather than fail the batch.
            continue
        arrival = order_date + pd.Timedelta(days=lead)
        rows.append(
            dict(
                order_date=order_date,
                arrival_date=arrival,
                store_id=store_id,
                sku_id=sku_id,
                on_hand=on_hand,
                suggested_qty=rec["suggested_qty"],
                service_level=service_level,
                reason=rec["reason"],
            )
        )
    return pd.DataFrame(rows)
