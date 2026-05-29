"""Pydantic schemas and pandas dtype maps for the table contracts.

The schemas defined here are the source of truth for column names and types
that flow between the science library, the pipelines, and the API.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class SKU(BaseModel):
    sku_id: str
    name: str
    department: str
    category: str
    subcategory: str
    pack_size: int = Field(ge=1)
    shelf_days: int = Field(ge=1)
    base_price: float = Field(gt=0)
    lead_time_days: int = Field(ge=1)


class Store(BaseModel):
    store_id: str
    name: str
    district: str
    region: str
    size_tier: str
    open_date: date


class Sale(BaseModel):
    date: date
    store_id: str
    sku_id: str
    units: int = Field(ge=0)
    revenue: float = Field(ge=0)
    price: float = Field(gt=0)
    on_promo: bool
    promo_depth: float = Field(ge=0, lt=1)


class Forecast(BaseModel):
    origin_date: date
    target_date: date
    horizon_day: int = Field(ge=1)
    store_id: str
    sku_id: str
    y_p50: float
    y_p10: float
    y_p90: float
    y_p025: float
    y_p975: float
    model: str


class Recommendation(BaseModel):
    order_date: date
    arrival_date: date
    store_id: str
    sku_id: str
    on_hand: int
    suggested_qty: int
    service_level: float
    reason: str


# Column lists, used to enforce shapes after CSV/parquet round-trips.
SALES_COLUMNS = [
    "date", "store_id", "sku_id", "units", "revenue",
    "price", "on_promo", "promo_depth",
]
SKU_COLUMNS = [
    "sku_id", "name", "department", "category", "subcategory",
    "pack_size", "shelf_days", "base_price", "lead_time_days",
]
STORE_COLUMNS = [
    "store_id", "name", "district", "region", "size_tier", "open_date",
]
FORECAST_COLUMNS = [
    "origin_date", "target_date", "horizon_day", "store_id", "sku_id",
    "y_p50", "y_p10", "y_p90", "y_p025", "y_p975", "model",
]
RECOMMENDATION_COLUMNS = [
    "order_date", "arrival_date", "store_id", "sku_id",
    "on_hand", "suggested_qty", "service_level", "reason",
]
