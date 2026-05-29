"""Forecast accuracy metrics.

Notes on choice:

- WAPE is our primary headline metric. Aggregates cleanly across hierarchies
  and is robust to intermittent zeros (unlike MAPE).
- Bias matters as much as magnitude for perishables. Always report it.
- Pinball loss evaluates quantile calibration directly. We use it to compare
  models that produce intervals.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred = np.asarray(y_pred, dtype="float64")
    denom = np.abs(y_true).sum()
    if denom == 0:
        return float("nan")
    return float(np.abs(y_true - y_pred).sum() / denom)


def bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred = np.asarray(y_pred, dtype="float64")
    denom = np.abs(y_true).sum()
    if denom == 0:
        return float("nan")
    return float((y_pred - y_true).sum() / denom)


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred = np.asarray(y_pred, dtype="float64")
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def pinball(y_true: np.ndarray, y_pred_q: np.ndarray, q: float) -> float:
    y_true = np.asarray(y_true, dtype="float64")
    y_pred_q = np.asarray(y_pred_q, dtype="float64")
    diff = y_true - y_pred_q
    return float(np.maximum(q * diff, (q - 1) * diff).mean())


def coverage(y_true: np.ndarray, y_lo: np.ndarray, y_hi: np.ndarray) -> float:
    """Empirical interval coverage. Compare with the nominal level (e.g. 0.80)."""
    y_true = np.asarray(y_true)
    return float(((y_true >= y_lo) & (y_true <= y_hi)).mean())


def summarize(
    df: pd.DataFrame,
    *,
    y_col: str = "y",
    yhat_col: str = "y_hat",
    group_cols: list[str] | None = None,
) -> pd.DataFrame:
    """Return per-group WAPE/bias/RMSE. If group_cols is None, single-row summary."""
    if group_cols:
        rows = []
        for keys, sub in df.groupby(group_cols):
            row = dict(zip(group_cols, keys if isinstance(keys, tuple) else (keys,)))
            row["n"] = len(sub)
            row["wape"] = wape(sub[y_col].values, sub[yhat_col].values)
            row["bias"] = bias(sub[y_col].values, sub[yhat_col].values)
            row["rmse"] = rmse(sub[y_col].values, sub[yhat_col].values)
            rows.append(row)
        return pd.DataFrame(rows)
    return pd.DataFrame(
        [
            {
                "n": len(df),
                "wape": wape(df[y_col].values, df[yhat_col].values),
                "bias": bias(df[y_col].values, df[yhat_col].values),
                "rmse": rmse(df[y_col].values, df[yhat_col].values),
            }
        ]
    )
