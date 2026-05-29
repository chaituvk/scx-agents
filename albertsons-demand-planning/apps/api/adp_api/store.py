"""Parquet-backed read store.

Loaded once at startup. The dataframes are tiny by web service standards
(low millions of rows max) so in-memory is the right call. For real
production scale, swap this for DuckDB-on-parquet without changing the
router signatures.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from adp_science.data.loaders import (
    load_forecasts,
    load_recommendations,
    load_sales,
    load_skus,
    load_stores,
)


class DataStore:
    """In-memory parquet-backed read store. Constructed once at startup."""

    def __init__(
        self,
        sales: pd.DataFrame,
        skus: pd.DataFrame,
        stores: pd.DataFrame,
        forecasts: pd.DataFrame,
        recommendations: pd.DataFrame,
        accuracy: pd.DataFrame,
    ):
        self.sales = sales
        self.skus = skus
        self.stores = stores
        self.forecasts = forecasts
        self._recommendations = recommendations
        self.accuracy = accuracy

    # ------------------------------------------------------------------
    # SKU / store lookups
    # ------------------------------------------------------------------

    def list_skus(self) -> list[dict]:
        return self.skus.to_dict("records")

    def list_stores(self) -> list[dict]:
        df = self.stores.copy()
        df["open_date"] = df["open_date"].dt.date.astype(str)
        return df.to_dict("records")

    # ------------------------------------------------------------------
    # forecasts
    # ------------------------------------------------------------------

    def forecast_series(self, store_id: str, sku_id: str) -> pd.DataFrame:
        f = self.forecasts
        sub = f[(f["store_id"] == store_id) & (f["sku_id"] == sku_id)]
        return sub.sort_values("target_date")

    def history_series(
        self, store_id: str, sku_id: str, *, days: int = 90
    ) -> pd.DataFrame:
        s = self.sales
        sub = s[(s["store_id"] == store_id) & (s["sku_id"] == sku_id)]
        if sub.empty:
            return sub
        last = sub["date"].max()
        cutoff = last - pd.Timedelta(days=days)
        return sub[sub["date"] >= cutoff].sort_values("date")

    # ------------------------------------------------------------------
    # recommendations
    # ------------------------------------------------------------------

    def recommendations(
        self,
        *,
        store_id: str | None = None,
        min_qty: int | None = None,
    ) -> pd.DataFrame:
        df = self._recommendations
        if store_id:
            df = df[df["store_id"] == store_id]
        if min_qty is not None:
            df = df[df["suggested_qty"] >= min_qty]
        return df.sort_values(["store_id", "sku_id"])

    # ------------------------------------------------------------------
    # accuracy
    # ------------------------------------------------------------------

    def accuracy_by(self, group_by: str) -> pd.DataFrame:
        if self.accuracy.empty:
            return pd.DataFrame()
        df = self.accuracy
        if group_by not in df.columns:
            raise ValueError(f"unknown group column: {group_by}")
        from adp_science.evaluate.metrics import bias, wape

        rows = []
        for key, sub in df.groupby(group_by):
            sub = sub.dropna(subset=["y", "y_hat"])
            if sub.empty:
                continue
            rows.append(
                {
                    group_by: key,
                    "n": int(len(sub)),
                    "wape": wape(sub["y"].values, sub["y_hat"].values),
                    "bias": bias(sub["y"].values, sub["y_hat"].values),
                }
            )
        return pd.DataFrame(rows).sort_values("wape", ascending=False)


def load(data_dir: Path) -> DataStore:
    """Load all parquet artifacts from `data_dir`."""
    raw = data_dir / "raw"
    fcst = data_dir / "forecasts" / "horizon.parquet"
    recs = data_dir / "recommendations" / "orders.parquet"
    acc = data_dir / "accuracy" / "backtest.parquet"

    sales = load_sales(raw / "sales.parquet") if (raw / "sales.parquet").exists() else _empty_sales()
    skus = load_skus(raw / "skus.parquet") if (raw / "skus.parquet").exists() else _empty_skus()
    stores = load_stores(raw / "stores.parquet") if (raw / "stores.parquet").exists() else _empty_stores()
    forecasts = load_forecasts(fcst) if fcst.exists() else _empty_forecasts()
    recommendations = load_recommendations(recs) if recs.exists() else _empty_recs()
    accuracy = pd.read_parquet(acc) if acc.exists() else pd.DataFrame()

    return DataStore(
        sales=sales,
        skus=skus,
        stores=stores,
        forecasts=forecasts,
        recommendations=recommendations,
        accuracy=accuracy,
    )


def _empty(cols: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=cols)


def _empty_sales() -> pd.DataFrame:
    return _empty(["date", "store_id", "sku_id", "units", "revenue", "price", "on_promo", "promo_depth"])


def _empty_skus() -> pd.DataFrame:
    return _empty(["sku_id", "name", "department", "category", "subcategory", "pack_size", "shelf_days", "base_price", "lead_time_days"])


def _empty_stores() -> pd.DataFrame:
    return _empty(["store_id", "name", "district", "region", "size_tier", "open_date"])


def _empty_forecasts() -> pd.DataFrame:
    return _empty(["origin_date", "target_date", "horizon_day", "store_id", "sku_id", "y_p50", "y_p10", "y_p90", "y_p025", "y_p975", "model"])


def _empty_recs() -> pd.DataFrame:
    return _empty(["order_date", "arrival_date", "store_id", "sku_id", "on_hand", "suggested_qty", "service_level", "reason"])
