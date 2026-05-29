"""FastAPI dependencies. Exposes the loaded DataStore as a singleton."""

from __future__ import annotations

from functools import lru_cache

from .settings import get_settings
from .store import DataStore, load


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    settings = get_settings()
    return load(settings.data_dir)
