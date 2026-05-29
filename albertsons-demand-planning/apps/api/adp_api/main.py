"""FastAPI app factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import catalog, forecasts, health, metrics, recommendations
from .settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Albertsons Intelligence - Demand Planning API",
        version="0.1.0",
        description=(
            "Forecast + replenishment service. Read-mostly; backed by parquet "
            "artifacts produced by the science pipelines."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(catalog.router)
    app.include_router(forecasts.router)
    app.include_router(recommendations.router)
    app.include_router(metrics.router)
    return app


app = create_app()
