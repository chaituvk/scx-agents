"""Settings sourced from env vars (see `.env.example`)."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ADP_", extra="ignore")

    data_dir: Path = Field(default=Path("infra/data"))
    cors_origin: str = Field(default="http://localhost:3000")


def get_settings() -> Settings:
    return Settings()
