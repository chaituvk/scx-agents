"""CLI: train the LightGBM + baseline forecasters on a sales panel."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import typer

from ..data.loaders import load_sales, load_skus, load_stores
from ..features.pipeline import build_panel
from ..forecast.baseline import SeasonalNaive
from ..forecast.lgbm import LgbmForecaster

app = typer.Typer(help="Train forecasting models.")


@app.command()
def main(
    sales: str = typer.Option(..., help="Path to sales.parquet."),
    skus: str = typer.Option(None, help="Path to skus.parquet (default: same dir as sales)."),
    stores: str = typer.Option(None, help="Path to stores.parquet (default: same dir as sales)."),
    out: str = typer.Option("infra/data/models", help="Output directory for model artifacts."),
    train_end: str = typer.Option(
        None,
        help="Use only rows up to this date (YYYY-MM-DD). Default: all data.",
    ),
):
    sales_path = Path(sales)
    skus_path = Path(skus) if skus else sales_path.parent / "skus.parquet"
    stores_path = Path(stores) if stores else sales_path.parent / "stores.parquet"

    sales_df = load_sales(sales_path)
    sku_df = load_skus(skus_path)
    store_df = load_stores(stores_path)

    if train_end:
        cutoff = pd.Timestamp(train_end)
        sales_df = sales_df[sales_df["date"] <= cutoff]
        typer.echo(f"using rows through {cutoff.date()} ({len(sales_df):,} rows)")

    panel = build_panel(sales_df, sku_df, store_df)

    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)

    typer.echo("training baseline (seasonal-naive)...")
    baseline = SeasonalNaive().fit(panel)
    import pickle

    with open(out_dir / "baseline.pkl", "wb") as f:
        pickle.dump(baseline, f)

    typer.echo("training lgbm quantile heads per category...")
    lgbm = LgbmForecaster().fit(panel)
    lgbm.save(out_dir / "lgbm.pkl")

    typer.echo(f"done. artifacts in {out_dir}")


if __name__ == "__main__":
    app()
