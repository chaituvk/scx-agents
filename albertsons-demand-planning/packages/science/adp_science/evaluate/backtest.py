"""Rolling-origin backtesting.

For each origin in `origins`, fit on data <= origin and predict the next
`horizon` days. Score against actuals. Concatenate.

This is the only honest way to evaluate a forecaster on time-series data with
strong seasonality. Single-window holdouts can be wildly misleading depending
on whether the holdout includes a holiday season.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import pandas as pd

from ..forecast.base import Forecaster
from .metrics import summarize


@dataclass(frozen=True)
class BacktestConfig:
    origins: tuple[pd.Timestamp, ...]
    horizon: int = 28


def rolling_origin(
    panel: pd.DataFrame,
    *,
    fit_fn,
    cfg: BacktestConfig,
) -> pd.DataFrame:
    """Run a rolling-origin backtest.

    Parameters
    ----------
    panel : long-format DataFrame with `date, store_id, sku_id, units` and any
            additional join columns (category etc.) needed by the model.
    fit_fn : callable taking a `train_panel` DataFrame and returning a fitted
             `Forecaster`. Reconstructed each origin so we don't leak state.
    cfg : backtest configuration.

    Returns
    -------
    DataFrame with columns `origin_date, target_date, store_id, sku_id, y, y_hat`.
    """
    rows: list[pd.DataFrame] = []
    panel = panel.sort_values(["store_id", "sku_id", "date"])
    for origin in cfg.origins:
        train = panel[panel["date"] <= origin]
        if train.empty:
            continue
        model: Forecaster = fit_fn(train)
        preds = model.predict(train, horizon=cfg.horizon)
        # Find actuals for the same target_dates we forecast.
        end = origin + timedelta(days=cfg.horizon)
        actuals = panel[(panel["date"] > origin) & (panel["date"] <= end)][
            ["date", "store_id", "sku_id", "units"]
        ].rename(columns={"date": "target_date", "units": "y"})
        # Use the p50 (q0.50) as the point forecast.
        preds = preds.rename(columns={"q0.50": "y_hat"})
        merged = preds.merge(actuals, on=["target_date", "store_id", "sku_id"], how="left")
        merged["origin_date"] = origin
        rows.append(merged)
    if not rows:
        return pd.DataFrame()
    return pd.concat(rows, ignore_index=True)


def summarize_backtest(backtest: pd.DataFrame) -> pd.DataFrame:
    """Convenience: WAPE/bias/RMSE by horizon_day."""
    if backtest.empty:
        return pd.DataFrame()
    df = backtest.dropna(subset=["y", "y_hat"])
    return summarize(df, group_cols=["horizon_day"]).sort_values("horizon_day")
