"""Smoke tests against the API using a tiny synthesized dataset."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Generate a tiny dataset + forecasts then spin up the app."""
    from adp_science.data.synthetic import GenSpec, generate
    from adp_science.data.loaders import load_sales, load_skus, load_stores
    from adp_science.features.pipeline import build_panel
    from adp_science.forecast.baseline import SeasonalNaive
    from adp_science.forecast.lgbm import LgbmForecaster
    from adp_science.forecast.ensemble import Ensemble
    from adp_science.data.schema import FORECAST_COLUMNS, RECOMMENDATION_COLUMNS
    from adp_science.optimize.replenishment import recommend_batch
    import pandas as pd

    root = tmp_path_factory.mktemp("data")
    raw = root / "raw"
    out_paths = generate(
        GenSpec(
            n_stores=2,
            n_skus_per_subcategory=1,
            start=date(2024, 1, 1),
            end=date(2024, 3, 31),
            seed=42,
        ),
        raw,
    )

    sales = load_sales(out_paths["sales"])
    skus = load_skus(out_paths["skus"])
    stores = load_stores(out_paths["stores"])
    panel = build_panel(sales, skus, stores)

    baseline = SeasonalNaive().fit(panel)
    lgbm = LgbmForecaster(n_estimators=80).fit(panel)
    bpred = baseline.predict(panel, horizon=7)
    lpred = lgbm.predict(panel, horizon=7)
    blend = Ensemble().combine(bpred, lpred)
    blend = blend.rename(columns={"q0.10": "y_p10", "q0.50": "y_p50", "q0.90": "y_p90"})
    blend["y_p025"] = (blend["y_p50"] - 1.96 * (blend["y_p90"] - blend["y_p10"]) / 2.56).clip(lower=0)
    blend["y_p975"] = blend["y_p50"] + 1.96 * (blend["y_p90"] - blend["y_p10"]) / 2.56
    blend["origin_date"] = sales["date"].max()
    blend["model"] = "ensemble"
    fcst_dir = root / "forecasts"
    fcst_dir.mkdir()
    blend[FORECAST_COLUMNS].to_parquet(fcst_dir / "horizon.parquet", index=False)

    # Recommendations
    fcst_q = blend.rename(columns={"y_p10": "q0.10", "y_p50": "q0.50", "y_p90": "q0.90"})
    fcst_q["horizon_day"] = (fcst_q["target_date"] - fcst_q["origin_date"]).dt.days
    recs = recommend_batch(fcst_q, skus, order_date=sales["date"].max() + pd.Timedelta(days=1))
    rec_dir = root / "recommendations"
    rec_dir.mkdir()
    recs[RECOMMENDATION_COLUMNS].to_parquet(rec_dir / "orders.parquet", index=False)

    os.environ["ADP_DATA_DIR"] = str(root)
    # Reload settings + store after env is set.
    from adp_api import deps
    deps.get_store.cache_clear()
    from adp_api.main import create_app
    return TestClient(create_app())


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    payload = r.json()
    assert payload["status"] == "ok"
    assert payload["tables"]["sku_count"] > 0


def test_list_skus(client):
    r = client.get("/catalog/skus")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_forecast_for_pair(client):
    skus = client.get("/catalog/skus").json()
    stores = client.get("/catalog/stores").json()
    sku_id = skus[0]["sku_id"]
    store_id = stores[0]["store_id"]
    r = client.get(f"/forecasts/{store_id}/{sku_id}")
    assert r.status_code == 200
    payload = r.json()
    assert "history" in payload
    assert "forecast" in payload
    assert len(payload["forecast"]) > 0


def test_recommendations_summary(client):
    r = client.get("/recommendations/summary")
    assert r.status_code == 200
    payload = r.json()
    assert "total_orders" in payload
    assert payload["total_orders"] > 0
