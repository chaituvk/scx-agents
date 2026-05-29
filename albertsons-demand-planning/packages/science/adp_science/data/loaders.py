"""Parquet readers that enforce schemas and dtype consistency.

The science code assumes well-typed inputs; these loaders are the only place
we touch the filesystem outside of the pipeline CLIs.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .schema import (
    FORECAST_COLUMNS,
    RECOMMENDATION_COLUMNS,
    SALES_COLUMNS,
    SKU_COLUMNS,
    STORE_COLUMNS,
)


def load_sales(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path, columns=SALES_COLUMNS)
    df["date"] = pd.to_datetime(df["date"])
    return df


def load_skus(path: str | Path) -> pd.DataFrame:
    return pd.read_parquet(path, columns=SKU_COLUMNS)


def load_stores(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path, columns=STORE_COLUMNS)
    df["open_date"] = pd.to_datetime(df["open_date"])
    return df


def load_forecasts(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path, columns=FORECAST_COLUMNS)
    df["origin_date"] = pd.to_datetime(df["origin_date"])
    df["target_date"] = pd.to_datetime(df["target_date"])
    return df


def load_recommendations(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path, columns=RECOMMENDATION_COLUMNS)
    df["order_date"] = pd.to_datetime(df["order_date"])
    df["arrival_date"] = pd.to_datetime(df["arrival_date"])
    return df
