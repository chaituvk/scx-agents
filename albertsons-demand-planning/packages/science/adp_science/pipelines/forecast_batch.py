"""CLI: produce a forecast horizon from saved models and write parquet."""

from __future__ import annotations

import pickle
from pathlib import Path

import pandas as pd
import typer

from ..config import DEFAULT_HORIZON_DAYS
from ..data.loaders import load_sales, load_skus, load_stores
from ..data.schema import FORECAST_COLUMNS
from ..features.pipeline import build_panel
from ..forecast.ensemble import Ensemble
from ..forecast.lgbm import LgbmForecaster

app = typer.Typer(help="Run a batch forecast.")


@app.command()
def main(
    sales: str = typer.Option(..., help="Path to sales.parquet."),
    models: str = typer.Option(..., help="Directory containing baseline.pkl and lgbm.pkl."),
    out: str = typer.Option("infra/data/forecasts", help="Output directory."),
    horizon: int = typer.Option(DEFAULT_HORIZON_DAYS, help="Days to forecast."),
    origin: str = typer.Option(None, help="Forecast origin date (YYYY-MM-DD). Default: max(date)."),
    ensemble_weight: float = typer.Option(0.3, help="Weight on baseline in the ensemble."),
):
    sales_path = Path(sales)
    sku_df = load_skus(sales_path.parent / "skus.parquet")
    store_df = load_stores(sales_path.parent / "stores.parquet")
    sales_df = load_sales(sales_path)

    if origin:
        origin_ts = pd.Timestamp(origin)
        sales_df = sales_df[sales_df["date"] <= origin_ts]
    else:
        origin_ts = sales_df["date"].max()

    panel = build_panel(sales_df, sku_df, store_df)

    models_dir = Path(models)
    with open(models_dir / "baseline.pkl", "rb") as f:
        baseline = pickle.load(f)
    lgbm = LgbmForecaster.load(models_dir / "lgbm.pkl")

    typer.echo(f"scoring baseline at origin {origin_ts.date()}...")
    base_preds = baseline.predict(panel, horizon=horizon)
    typer.echo("scoring lgbm...")
    lgbm_preds = lgbm.predict(panel, horizon=horizon)

    typer.echo("blending ensemble...")
    ens = Ensemble(weight_baseline=ensemble_weight).combine(base_preds, lgbm_preds)

    # Project to the canonical forecast schema.
    out_df = ens.rename(
        columns={
            "q0.10": "y_p10",
            "q0.50": "y_p50",
            "q0.90": "y_p90",
        }
    )
    # 95% bounds from a Gaussian fit of the 10/90 spread.
    z80, z95 = 1.2816, 1.96
    half = (out_df["y_p90"] - out_df["y_p10"]) / (2 * z80)
    out_df["y_p025"] = (out_df["y_p50"] - z95 * half).clip(lower=0)
    out_df["y_p975"] = out_df["y_p50"] + z95 * half
    out_df["origin_date"] = origin_ts
    out_df["model"] = "ensemble"
    out_df = out_df[FORECAST_COLUMNS]

    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "horizon.parquet"
    out_df.to_parquet(out_path, index=False)
    typer.echo(f"wrote {len(out_df):,} forecast rows to {out_path}")


if __name__ == "__main__":
    app()
