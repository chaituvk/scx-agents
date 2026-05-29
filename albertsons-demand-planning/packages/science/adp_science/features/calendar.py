"""Calendar features.

These are all known at any future date - no leakage concerns.
"""

from __future__ import annotations

import pandas as pd

try:
    import holidays as _holidays
    _US_HOLIDAYS = _holidays.UnitedStates()
except Exception:  # pragma: no cover
    _US_HOLIDAYS = {}


def add_calendar_features(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """Append day-of-week, month, holiday, days-to-holiday columns.

    Modifies a copy. Returns the new frame.
    """
    out = df.copy()
    d = pd.to_datetime(out[date_col])
    out["dow"] = d.dt.dayofweek.astype("int16")
    out["doy"] = d.dt.dayofyear.astype("int16")
    out["week"] = d.dt.isocalendar().week.astype("int16")
    out["month"] = d.dt.month.astype("int8")
    out["is_weekend"] = (out["dow"] >= 5).astype("int8")

    dates = d.dt.date
    out["is_holiday"] = dates.map(lambda x: 1 if x in _US_HOLIDAYS else 0).astype("int8")

    # days-to-next-holiday up to 14 days out; saturates beyond.
    horizon = 14
    next_offsets = pd.Series(horizon + 1, index=out.index, dtype="int16")
    if _US_HOLIDAYS:
        for i, dt in enumerate(dates):
            for offset in range(horizon + 1):
                if (pd.Timestamp(dt) + pd.Timedelta(days=offset)).date() in _US_HOLIDAYS:
                    next_offsets.iat[i] = offset
                    break
    out["days_to_holiday"] = next_offsets

    return out
