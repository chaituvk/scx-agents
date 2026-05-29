from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_store
from ..store import DataStore

router = APIRouter()


@router.get("/health")
def health(store: DataStore = Depends(get_store)) -> dict:
    return {
        "status": "ok",
        "tables": {
            "sales_rows": len(store.sales),
            "sku_count": len(store.skus),
            "store_count": len(store.stores),
            "forecast_rows": len(store.forecasts),
            "recommendation_rows": len(store.recommendations()),
            "accuracy_rows": len(store.accuracy),
        },
    }
