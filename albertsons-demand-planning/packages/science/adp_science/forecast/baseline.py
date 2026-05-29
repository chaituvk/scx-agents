"""Seasonal-naive baseline.

`y_hat_{t+h}` = mean of the last `K` same-DOW values up to the forecast origin.
Two reasons to keep this around even after we have LightGBM:

  1. It's a robust floor: brand-new SKUs with no lag history still get a
     reasonable forecast.
  2. It ensembles well with the ML model in noisy categories where the model
     tends to overfit weekly patterns.

Quantiles come from an empirical residual distribution over the training panel.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import QUANTILES


class SeasonalNaive:
    name = "baseline"

    def __init__(self, lookback_weeks: int = 4):
        self.lookback_weeks = lookback_weeks
        self._residual_quantiles: dict[float, float] = {}

    def fit(self, panel: pd.DataFrame) -> "SeasonalNaive":
        """Compute residual quantiles on in-sample seasonal-naive forecasts."""
        df = panel.sort_values(["store_id", "sku_id", "date"]).copy()
        df["snaive_hat"] = (
            df.groupby(["store_id", "sku_id"], sort=False)["units"]
            .transform(lambda s: s.shift(7).rolling(self.lookback_weeks, min_periods=1).mean())
        )
        resid = (df["units"] - df["snaive_hat"]).dropna().to_numpy()
        # Center on zero so quantiles are interpretable as +/- deltas.
        for q in QUANTILES:
            self._residual_quantiles[q] = float(np.quantile(resid, q))
        return self

    def predict(self, panel: pd.DataFrame, *, horizon: int) -> pd.DataFrame:
        """Score each (store, sku) panel and produce a `horizon`-day forecast.

        `panel` is assumed to be one origin's worth of history per group, with
        a `date` column ending at the origin. We extend forward by `horizon`
        days using the rolling same-DOW mean.
        """
        out_rows = []
        for (store_id, sku_id), grp in panel.groupby(["store_id", "sku_id"], sort=False):
            grp = grp.sort_values("date")
            last_date = grp["date"].max()
            # Build a rolling same-DOW mean from the trailing lookback_weeks*7 days.
            tail = grp.tail(self.lookback_weeks * 7)
            dow_mean = tail.groupby(tail["date"].dt.dayofweek)["units"].mean()
            overall_mean = float(tail["units"].mean()) if len(tail) else 0.0

            for h in range(1, horizon + 1):
                target = last_date + pd.Timedelta(days=h)
                yhat = float(dow_mean.get(target.dayofweek, overall_mean))
                row = {
                    "target_date": target,
                    "horizon_day": h,
                    "store_id": store_id,
                    "sku_id": sku_id,
                }
                for q, delta in self._residual_quantiles.items():
                    # Add residual delta. Clip at 0 since units can't be negative.
                    row[f"q{q:.2f}"] = max(0.0, yhat + delta)
                out_rows.append(row)
        return pd.DataFrame(out_rows)
