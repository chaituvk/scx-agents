"""CLI: synthesize a sales panel + dimensions and write parquet."""

from __future__ import annotations

from datetime import date

import typer

from ..data.synthetic import GenSpec, generate

app = typer.Typer(help="Generate synthetic grocery demand data.")


@app.command()
def main(
    out: str = typer.Option("infra/data/raw", help="Output directory for parquet files."),
    n_stores: int = typer.Option(10, help="Number of stores."),
    n_skus_per_subcategory: int = typer.Option(4, help="SKUs per subcategory."),
    start: str = typer.Option("2024-01-01", help="Inclusive start date (YYYY-MM-DD)."),
    end: str = typer.Option("2025-12-31", help="Inclusive end date (YYYY-MM-DD)."),
    seed: int = typer.Option(7, help="RNG seed for reproducibility."),
):
    spec = GenSpec(
        n_stores=n_stores,
        n_skus_per_subcategory=n_skus_per_subcategory,
        start=date.fromisoformat(start),
        end=date.fromisoformat(end),
        seed=seed,
    )
    out_paths = generate(spec, out)
    for name, path in out_paths.items():
        typer.echo(f"wrote {name}: {path}")


if __name__ == "__main__":
    app()
