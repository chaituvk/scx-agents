from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_store
from ..store import DataStore

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/skus")
def list_skus(store: DataStore = Depends(get_store)) -> list[dict]:
    return store.list_skus()


@router.get("/stores")
def list_stores(store: DataStore = Depends(get_store)) -> list[dict]:
    return store.list_stores()
