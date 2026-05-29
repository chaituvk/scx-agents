from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import get_store
from ..store import DataStore

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/accuracy")
def accuracy(
    group_by: str = Query("horizon_day", description="Column to group by."),
    store: DataStore = Depends(get_store),
) -> list[dict]:
    """WAPE/bias by category, store, or horizon day."""
    try:
        df = store.accuracy_by(group_by)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return df.to_dict("records")
