from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_store
from ..store import DataStore

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("/{store_id}/{sku_id}")
def forecast_for_pair(
    store_id: str,
    sku_id: str,
    history_days: int = Query(90, ge=0, le=365),
    store: DataStore = Depends(get_store),
) -> dict:
    """Return history + forecast for a single (store, SKU)."""
    history = store.history_series(store_id, sku_id, days=history_days)
    forecast = store.forecast_series(store_id, sku_id)
    if forecast.empty:
        raise HTTPException(404, f"no forecast for {store_id}/{sku_id}")

    return {
        "store_id": store_id,
        "sku_id": sku_id,
        "history": [
            {
                "date": d.date().isoformat(),
                "units": int(u),
                "on_promo": bool(p),
            }
            for d, u, p in zip(history["date"], history["units"], history["on_promo"])
        ],
        "forecast": [
            {
                "target_date": d.date().isoformat(),
                "horizon_day": int(h),
                "p10": float(p10),
                "p50": float(p50),
                "p90": float(p90),
                "p025": float(p025),
                "p975": float(p975),
            }
            for d, h, p10, p50, p90, p025, p975 in zip(
                forecast["target_date"],
                forecast["horizon_day"],
                forecast["y_p10"],
                forecast["y_p50"],
                forecast["y_p90"],
                forecast["y_p025"],
                forecast["y_p975"],
            )
        ],
    }


@router.get("")
def list_forecasts(
    store_id: str | None = None,
    sku_id: str | None = None,
    limit: int = Query(500, ge=1, le=5000),
    store: DataStore = Depends(get_store),
) -> list[dict]:
    """Filter forecasts by store/SKU. Returns flat rows."""
    df = store.forecasts
    if store_id:
        df = df[df["store_id"] == store_id]
    if sku_id:
        df = df[df["sku_id"] == sku_id]
    df = df.head(limit).copy()
    df["target_date"] = df["target_date"].dt.date.astype(str)
    df["origin_date"] = df["origin_date"].dt.date.astype(str)
    return df.to_dict("records")
