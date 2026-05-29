"""Lag and rolling features.

We compute them per (store_id, sku_id) panel and **always trailing**:
the value at row t is computed from rows <= t - 1 (or further back for
explicit lags). This keeps them safe at all horizons up to the smallest lag.
"""

from __future__ import annotations

import pandas as pd

from ..config import LAG_DAYS, ROLLING_WINDOWS


def add_lag_features(
    df: pd.DataFrame,
    *,
    group_cols: tuple[str, ...] = ("store_id", "sku_id"),
    target: str = "units",
    lag_days: tuple[int, ...] = LAG_DAYS,
    rolling_windows: tuple[int, ...] = ROLLING_WINDOWS,
) -> pd.DataFrame:
    """Append `{target}_lag_{k}` and `{target}_rmean_{w}` / `_rstd_{w}` columns.

    The input must already be sorted by `(group_cols, date)`.
    """
    out = df.copy()
    grouped = out.groupby(list(group_cols), sort=False)[target]

    for k in lag_days:
        out[f"{target}_lag_{k}"] = grouped.shift(k)

    for w in rolling_windows:
        min_p = max(2, w // 2)
        # transform keeps the original index and is the safest pattern for
        # group-wise rolling. shift(1) then roll => strictly trailing.
        out[f"{target}_rmean_{w}"] = grouped.transform(
            lambda s, w=w, min_p=min_p: s.shift(1).rolling(w, min_periods=min_p).mean()
        )
        out[f"{target}_rstd_{w}"] = grouped.transform(
            lambda s, w=w, min_p=min_p: s.shift(1).rolling(w, min_periods=min_p).std()
        )
    return out
