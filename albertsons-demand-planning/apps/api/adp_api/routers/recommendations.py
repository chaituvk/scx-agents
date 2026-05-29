from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..deps import get_store
from ..store import DataStore

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("")
def list_recommendations(
    store_id: str | None = None,
    min_qty: int | None = Query(None, ge=0),
    limit: int = Query(500, ge=1, le=5000),
    store: DataStore = Depends(get_store),
) -> list[dict]:
    df = store.recommendations(store_id=store_id, min_qty=min_qty)
    df = df.head(limit).copy()
    if not df.empty:
        df["order_date"] = df["order_date"].dt.date.astype(str)
        df["arrival_date"] = df["arrival_date"].dt.date.astype(str)
    return df.to_dict("records")


@router.get("/summary")
def summary(store: DataStore = Depends(get_store)) -> dict:
    """Headline aggregates for the dashboard home."""
    df = store.recommendations()
    if df.empty:
        return {"total_orders": 0, "total_units": 0, "by_store": []}
    by_store = (
        df.groupby("store_id")
        .agg(orders=("sku_id", "count"), units=("suggested_qty", "sum"))
        .reset_index()
        .to_dict("records")
    )
    return {
        "total_orders": int(len(df)),
        "total_units": int(df["suggested_qty"].sum()),
        "by_store": by_store,
    }
