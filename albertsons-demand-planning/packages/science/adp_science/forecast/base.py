"""Common types and the model protocol.

All forecasters expose `.fit(panel)` and `.predict(panel) -> dict` returning a
mapping `{quantile: ndarray}` so the ensemble can blend them uniformly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ForecastResult:
    target_dates: pd.DatetimeIndex
    store_id: str
    sku_id: str
    quantiles: dict[float, np.ndarray]


class Forecaster(Protocol):
    name: str

    def fit(self, panel: pd.DataFrame) -> "Forecaster": ...
    def predict(
        self, panel: pd.DataFrame, *, horizon: int
    ) -> pd.DataFrame: ...
