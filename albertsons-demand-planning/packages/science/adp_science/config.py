"""Global configuration constants.

Anything that's tunable but not per-call lives here. Per-call config goes on
the function/dataclass it belongs to.
"""

from __future__ import annotations

from dataclasses import dataclass


# Forecast horizon in days. Demand planning at grocery typically runs 14-28
# days; we default to 28 for headroom on slower-moving SKUs.
DEFAULT_HORIZON_DAYS = 28

# Lag features available to the model. Anchored at day 7 so they're safe at
# every horizon up to 7 days; longer horizons rely on rolling means.
LAG_DAYS = (7, 14, 28)

# Rolling-mean windows. Trailing only — see features/lags.py.
ROLLING_WINDOWS = (7, 28)

# Quantile targets for the prediction interval heads.
QUANTILES = (0.10, 0.50, 0.90)

# Service level used when quantiles aren't available (e.g. cold-start).
DEFAULT_SERVICE_LEVEL = 0.95

# Where pipelines write artifacts by default. Override with --out on the CLI.
@dataclass(frozen=True)
class DataPaths:
    raw: str = "infra/data/raw"
    models: str = "infra/data/models"
    forecasts: str = "infra/data/forecasts"
    recommendations: str = "infra/data/recommendations"
    accuracy: str = "infra/data/accuracy"


PATHS = DataPaths()
