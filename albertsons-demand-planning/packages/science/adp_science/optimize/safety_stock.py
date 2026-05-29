"""Safety stock computation from a quantile forecast.

Approach: derive (mu, sigma) of the lead-time + review-period demand by
summing the per-day quantile forecasts. We Gaussian-fit the resulting
aggregate using the 10th and 90th percentiles, which is reasonable when
multiple days are summed (CLT kicks in) even if the per-day distribution
is over-dispersed.

Order-up-to level:

    S = mu_LT+R + z_alpha * sigma_LT+R

`z_alpha` is the inverse standard normal at the target service level.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.stats import norm


@dataclass(frozen=True)
class StockParams:
    lead_time_days: int
    review_days: int = 1
    service_level: float = 0.95
    max_shelf_days: int | None = None  # cap S for perishables


def order_up_to(
    forecast_p10: np.ndarray,
    forecast_p50: np.ndarray,
    forecast_p90: np.ndarray,
    params: StockParams,
) -> tuple[float, float, float]:
    """Compute (mu_LR, sigma_LR, S) for the lead-time + review window.

    Each `forecast_*` array is a per-day quantile forecast aligned with the
    same horizon index. We sum the first `lead_time + review_days` entries.
    """
    horizon_window = params.lead_time_days + params.review_days
    if horizon_window <= 0:
        raise ValueError("lead_time + review window must be positive")

    p10 = np.asarray(forecast_p10, dtype="float64")[:horizon_window]
    p50 = np.asarray(forecast_p50, dtype="float64")[:horizon_window]
    p90 = np.asarray(forecast_p90, dtype="float64")[:horizon_window]
    if len(p50) < horizon_window:
        raise ValueError("forecast horizon shorter than lead_time + review_days")

    mu = float(p50.sum())
    # sigma per day from the 10/90 spread, summed in quadrature (independence
    # assumption - good enough for demand planning).
    z = norm.ppf(0.90)  # ~1.2816
    sigma_per_day = np.maximum((p90 - p10) / (2 * z), 1e-6)
    sigma = float(np.sqrt((sigma_per_day ** 2).sum()))

    z_alpha = norm.ppf(params.service_level)
    S = mu + z_alpha * sigma

    if params.max_shelf_days is not None:
        # Bound S so we never ask for more than `max_shelf_days` of demand.
        S = min(S, float(p50.sum() * (params.max_shelf_days / horizon_window)))

    return mu, sigma, max(0.0, S)
