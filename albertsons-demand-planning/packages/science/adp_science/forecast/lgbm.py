"""LightGBM quantile-regression forecaster.

We fit one model per quantile per category. Per-category isolation is the
single biggest quality lever: bakery is a totally different beast from ambient
pantry, and a global model averages those signals away.

The model is **recursive** at predict time: for horizons > 1 we don't have
lagged actuals, so we substitute the previous horizon's point prediction as
the lag input. This is a deliberate, simple choice; a direct-multi-output
model is in the roadmap.
"""

from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
    _HAS_LGBM = True
except Exception:  # pragma: no cover
    _HAS_LGBM = False
    lgb = None  # type: ignore

from ..config import QUANTILES
from ..features.pipeline import (
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    add_features,
    select_features,
)


class LgbmForecaster:
    name = "lgbm"

    def __init__(
        self,
        *,
        n_estimators: int = 400,
        learning_rate: float = 0.05,
        num_leaves: int = 63,
        min_data_in_leaf: int = 50,
        feature_fraction: float = 0.9,
        bagging_fraction: float = 0.8,
        bagging_freq: int = 5,
        random_state: int = 42,
    ):
        if not _HAS_LGBM:
            raise RuntimeError(
                "lightgbm is not installed. Install with `pip install lightgbm`."
            )
        self.params = dict(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            num_leaves=num_leaves,
            min_data_in_leaf=min_data_in_leaf,
            feature_fraction=feature_fraction,
            bagging_fraction=bagging_fraction,
            bagging_freq=bagging_freq,
            random_state=random_state,
        )
        self.models: dict[str, dict[float, "lgb.LGBMRegressor"]] = {}
        self.categories_seen_: list[str] = []

    # ---- fit ------------------------------------------------------------

    def fit(self, panel: pd.DataFrame) -> "LgbmForecaster":
        df = add_features(panel.copy())
        df = df.dropna(subset=[f for f in NUMERIC_FEATURES if "lag" in f or "rmean" in f])
        if df.empty:
            raise ValueError("training panel has no rows after lag warm-up")

        self.categories_seen_ = sorted(df["category"].dropna().unique().tolist())
        for cat in self.categories_seen_:
            sub = df[df["category"] == cat]
            X = select_features(sub)
            y = sub["units"].astype("float32")
            cat_models: dict[float, lgb.LGBMRegressor] = {}
            for q in QUANTILES:
                model = lgb.LGBMRegressor(
                    objective="quantile",
                    alpha=q,
                    verbose=-1,
                    **self.params,
                )
                model.fit(
                    X,
                    y,
                    categorical_feature=[
                        c for c in CATEGORICAL_FEATURES if c in X.columns
                    ],
                )
                cat_models[q] = model
            self.models[cat] = cat_models
        return self

    # ---- predict --------------------------------------------------------

    def predict(self, panel: pd.DataFrame, *, horizon: int) -> pd.DataFrame:
        """Recursive multi-step forecast per (store, sku).

        `panel` should already contain history for each group ending at the
        forecast origin. We extend it day by day, recomputing features.
        """
        groups = panel.groupby(["store_id", "sku_id"], sort=False)
        out_rows: list[dict] = []

        # We work on a per-group basis to keep memory bounded and feature
        # construction simple (single-group lag/rolling).
        for (store_id, sku_id), grp in groups:
            history = grp.sort_values("date").copy()
            if "category" not in history.columns or history["category"].isna().all():
                # Cannot route to a category model.
                continue
            cat = history["category"].iloc[-1]
            if cat not in self.models:
                continue
            last_date = history["date"].max()

            # Build a working frame we'll extend in place.
            working = history.copy()

            for h in range(1, horizon + 1):
                target_date = last_date + pd.Timedelta(days=h)
                # Carry forward exogenous fields from last row.
                last_row = working.iloc[-1]
                new_row = {
                    "date": target_date,
                    "store_id": store_id,
                    "sku_id": sku_id,
                    "units": np.nan,
                    "revenue": np.nan,
                    "price": last_row["price"],
                    "on_promo": False,
                    "promo_depth": 0.0,
                    "category": cat,
                    "subcategory": last_row.get("subcategory", None),
                    "department": last_row.get("department", None),
                    "size_tier": last_row.get("size_tier", None),
                    "district": last_row.get("district", None),
                    "region": last_row.get("region", None),
                }
                working = pd.concat([working, pd.DataFrame([new_row])], ignore_index=True)
                feats = add_features(working)
                X_row = select_features(feats.tail(1))

                quantiles: dict[float, float] = {}
                for q, model in self.models[cat].items():
                    yhat = float(model.predict(X_row)[0])
                    quantiles[q] = max(0.0, yhat)

                # Substitute the median back so subsequent lags are stable.
                working.iat[-1, working.columns.get_loc("units")] = quantiles[0.50]

                row = {
                    "target_date": target_date,
                    "horizon_day": h,
                    "store_id": store_id,
                    "sku_id": sku_id,
                }
                for q, v in quantiles.items():
                    row[f"q{q:.2f}"] = v
                out_rows.append(row)

        return pd.DataFrame(out_rows)

    # ---- persistence ----------------------------------------------------

    def save(self, path: str | Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {"params": self.params, "models": self.models, "categories": self.categories_seen_},
                f,
            )

    @classmethod
    def load(cls, path: str | Path) -> "LgbmForecaster":
        with open(path, "rb") as f:
            payload = pickle.load(f)
        obj = cls.__new__(cls)
        obj.params = payload["params"]
        obj.models = payload["models"]
        obj.categories_seen_ = payload["categories"]
        return obj
