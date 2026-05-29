"""CLI: produce a replenishment recommendation parquet from a forecast horizon."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import typer

from ..data.loaders import load_forecasts, load_skus
from ..data.schema import RECOMMENDATION_COLUMNS
from ..optimize.replenishment import recommend_batch

app = typer.Typer(help="Produce replenishment recommendations.")


@app.command()
def main(
    forecasts: str = typer.Option(..., help="Path to forecasts/horizon.parquet."),
    skus: str = typer.Option(..., help="Path to skus.parquet."),
    out: str = typer.Option("infra/data/recommendations", help="Output directory."),
    service_level: float = typer.Option(0.95, help="Target service level."),
):
    fcst = load_forecasts(forecasts)
    sku_df = load_skus(skus)
    order_date = fcst["origin_date"].max() + pd.Timedelta(days=1)

    # Rename to the q* schema the optimizer expects.
    fcst_q = fcst.rename(
        columns={"y_p10": "q0.10", "y_p50": "q0.50", "y_p90": "q0.90"}
    )
    fcst_q["horizon_day"] = (fcst_q["target_date"] - fcst_q["origin_date"]).dt.days
    recs = recommend_batch(
        fcst_q,
        sku_df,
        order_date=order_date,
        service_level=service_level,
    )
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "orders.parquet"
    recs[RECOMMENDATION_COLUMNS].to_parquet(out_path, index=False)
    typer.echo(f"wrote {len(recs):,} recommendations to {out_path}")


if __name__ == "__main__":
    app()
