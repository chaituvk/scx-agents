"""Unified CLI entry point: `adp <command>`."""

from __future__ import annotations

import typer

from .pipelines import backtest as backtest_cli
from .pipelines import forecast_batch as forecast_cli
from .pipelines import generate_data as gen_cli
from .pipelines import replenish as replenish_cli
from .pipelines import train as train_cli

app = typer.Typer(help="Albertsons Demand Planning - science CLI.")
app.add_typer(gen_cli.app, name="generate", help="Synthesize a sales panel.")
app.add_typer(train_cli.app, name="train", help="Train forecasting models.")
app.add_typer(forecast_cli.app, name="forecast", help="Run a batch forecast.")
app.add_typer(replenish_cli.app, name="replenish", help="Produce replenishment recs.")
app.add_typer(backtest_cli.app, name="backtest", help="Rolling-origin backtest.")


if __name__ == "__main__":
    app()
