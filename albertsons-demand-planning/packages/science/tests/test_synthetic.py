"""Smoke tests for synthetic data generation."""

from __future__ import annotations

from datetime import date

from adp_science.data.synthetic import GenSpec, generate


def test_generate_writes_three_parquets(tmp_path):
    spec = GenSpec(
        n_stores=2,
        n_skus_per_subcategory=1,
        start=date(2024, 1, 1),
        end=date(2024, 1, 30),
        seed=1,
    )
    out = generate(spec, tmp_path)
    for name in ("sales", "skus", "stores"):
        assert out[name].exists()


def test_generate_panel_is_complete(tmp_path):
    """For every (store, sku, day) we should emit exactly one sales row."""
    import pandas as pd

    spec = GenSpec(
        n_stores=2,
        n_skus_per_subcategory=1,
        start=date(2024, 1, 1),
        end=date(2024, 1, 10),
        seed=1,
    )
    out = generate(spec, tmp_path)
    sales = pd.read_parquet(out["sales"])
    skus = pd.read_parquet(out["skus"])
    stores = pd.read_parquet(out["stores"])
    expected = len(skus) * len(stores) * 10  # 10 days
    assert len(sales) == expected


def test_units_are_nonneg(tmp_path):
    import pandas as pd

    out = generate(
        GenSpec(
            n_stores=2,
            n_skus_per_subcategory=1,
            start=date(2024, 1, 1),
            end=date(2024, 1, 10),
            seed=1,
        ),
        tmp_path,
    )
    sales = pd.read_parquet(out["sales"])
    assert (sales["units"] >= 0).all()
