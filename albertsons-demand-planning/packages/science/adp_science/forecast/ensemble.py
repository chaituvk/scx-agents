"""Convex ensemble of baseline + LightGBM forecasts.

We blend at the quantile level:

    q_ens = w * q_baseline + (1 - w) * q_lgbm

`w` is currently constant per category (configured at construction). A
horizon-dependent w fit on a holdout window is straightforward and is one of
the next-step improvements in the roadmap.
"""

from __future__ import annotations

import pandas as pd

from ..config import QUANTILES


class Ensemble:
    name = "ensemble"

    def __init__(self, weight_baseline: float = 0.3):
        if not 0.0 <= weight_baseline <= 1.0:
            raise ValueError("weight_baseline must be in [0, 1]")
        self.w = weight_baseline

    def combine(
        self,
        baseline: pd.DataFrame,
        lgbm: pd.DataFrame,
    ) -> pd.DataFrame:
        """Inner-join on (target_date, store, sku) and blend quantile columns."""
        key = ["target_date", "horizon_day", "store_id", "sku_id"]
        df = baseline.merge(lgbm, on=key, how="inner", suffixes=("_b", "_l"))
        for q in QUANTILES:
            col = f"q{q:.2f}"
            df[col] = self.w * df[f"{col}_b"] + (1 - self.w) * df[f"{col}_l"]
        # Keep only the blended columns.
        keep = key + [f"q{q:.2f}" for q in QUANTILES]
        return df[keep]
