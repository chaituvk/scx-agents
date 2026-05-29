"""CLI: run a rolling-origin backtest and write an accuracy table."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import typer

from ..data.loaders import load_sales, load_skus, load_stores
from ..evaluate.backtest import BacktestConfig, rolling_origin, summarize_backtest
from ..features.pipeline import build_panel
from ..forecast.lgbm import LgbmForecaster

app = typer.Typer(help="Rolling-origin backtest.")


@app.command()
def main(
    sales: str = typer.Option(..., help="Path to sales.parquet."),
    out: str = typer.Option("infra/data/accuracy", help="Output directory."),
    horizon: int = typer.Option(28, help="Forecast horizon."),
    n_origins: int = typer.Option(3, help="Number of rolling origins."),
    spacing_days: int = typer.Option(30, help="Days between origins."),
):
    sales_path = Path(sales)
    sales_df = load_sales(sales_path)
    sku_df = load_skus(sales_path.parent / "skus.parquet")
    store_df = load_stores(sales_path.parent / "stores.parquet")
    panel = build_panel(sales_df, sku_df, store_df)

    last = panel["date"].max()
    origins = tuple(
        last - pd.Timedelta(days=horizon + spacing_days * (i + 1))
        for i in reversed(range(n_origins))
    )
    cfg = BacktestConfig(origins=origins, horizon=horizon)

    def fit_fn(train_panel):
        return LgbmForecaster(n_estimators=200).fit(train_panel)

    typer.echo(f"backtesting at origins {[o.date() for o in origins]}...")
    backtest = rolling_origin(panel, fit_fn=fit_fn, cfg=cfg)

    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    backtest.to_parquet(out_dir / "backtest.parquet", index=False)
    summarize_backtest(backtest).to_csv(out_dir / "summary.csv", index=False)
    typer.echo(f"wrote backtest with {len(backtest):,} rows to {out_dir}")


if __name__ == "__main__":
    app()
