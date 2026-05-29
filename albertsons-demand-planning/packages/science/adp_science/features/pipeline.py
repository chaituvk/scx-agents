"""Top-level feature pipeline.

This is the canonical preprocessing path used by both training and inference.
Keeping it in one function prevents "train one set of features, predict
another" bugs - the most common source of silent quality regressions.
"""

from __future__ import annotations

import pandas as pd

from .calendar import add_calendar_features
from .lags import add_lag_features


# Columns the model will read at train and inference time.
# Listed explicitly so a typo can't silently drop a feature.
NUMERIC_FEATURES = [
    "dow", "doy", "week", "month", "is_weekend", "is_holiday", "days_to_holiday",
    "price", "promo_depth",
    "units_lag_7", "units_lag_14", "units_lag_28",
    "units_rmean_7", "units_rmean_28",
    "units_rstd_7", "units_rstd_28",
]

CATEGORICAL_FEATURES = [
    "store_id", "sku_id", "subcategory", "size_tier",
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

TARGET = "units"


def build_panel(
    sales: pd.DataFrame,
    skus: pd.DataFrame,
    stores: pd.DataFrame,
) -> pd.DataFrame:
    """Join sales with sku/store dimensions and sort by panel order."""
    df = sales.merge(
        skus[["sku_id", "category", "subcategory", "department"]],
        on="sku_id",
        how="left",
    ).merge(
        stores[["store_id", "size_tier", "district", "region"]],
        on="store_id",
        how="left",
    )
    df = df.sort_values(["store_id", "sku_id", "date"]).reset_index(drop=True)
    return df


def add_features(panel: pd.DataFrame) -> pd.DataFrame:
    """Apply the full feature pipeline to a joined panel."""
    out = add_calendar_features(panel)
    out = add_lag_features(out)
    # Cast string features to category for LightGBM.
    for col in CATEGORICAL_FEATURES:
        if col in out.columns:
            out[col] = out[col].astype("category")
    return out


def select_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return the model input frame in the canonical column order."""
    cols = [c for c in ALL_FEATURES if c in df.columns]
    return df[cols]
