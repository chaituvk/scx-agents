"""Tests for feature engineering invariants."""

from __future__ import annotations

import numpy as np
import pandas as pd

from adp_science.features.calendar import add_calendar_features
from adp_science.features.lags import add_lag_features


def _panel():
    dates = pd.date_range("2024-01-01", periods=60, freq="D")
    return pd.DataFrame(
        {
            "date": np.tile(dates, 2),
            "store_id": ["S-1"] * 60 + ["S-2"] * 60,
            "sku_id": ["A"] * 120,
            "units": list(range(60)) + list(range(60, 120)),
        }
    ).sort_values(["store_id", "sku_id", "date"]).reset_index(drop=True)


def test_calendar_columns():
    df = add_calendar_features(_panel())
    for col in ("dow", "doy", "week", "month", "is_weekend", "is_holiday", "days_to_holiday"):
        assert col in df.columns
    assert df["dow"].between(0, 6).all()
    assert df["is_weekend"].isin([0, 1]).all()


def test_lag_features_are_strictly_trailing():
    """A lag_7 value at row t must equal the target at row t - 7 of the same group."""
    df = add_lag_features(_panel())
    s1 = df[df["store_id"] == "S-1"].reset_index(drop=True)
    for t in range(10, len(s1)):
        assert s1.loc[t, "units_lag_7"] == s1.loc[t - 7, "units"]


def test_rolling_mean_excludes_current_row():
    """rmean at row t must not include y_t."""
    df = add_lag_features(_panel())
    s1 = df[df["store_id"] == "S-1"].reset_index(drop=True)
    # At a late row the mean of the prior 7 units should equal pandas rolling on shifted.
    # min_periods follows the implementation: max(2, w // 2) = 3 for w=7.
    expected = s1["units"].shift(1).rolling(7, min_periods=3).mean()
    pd.testing.assert_series_equal(
        s1["units_rmean_7"].reset_index(drop=True),
        expected.reset_index(drop=True),
        check_names=False,
    )


def test_groupwise_isolation():
    """Lags should not bleed across groups."""
    df = add_lag_features(_panel())
    s2_first = df[(df["store_id"] == "S-2")].iloc[0]
    # First S-2 row should have NaN for lag_7 (no prior S-2 rows).
    assert pd.isna(s2_first["units_lag_7"])
