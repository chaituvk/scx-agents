"""Tests for safety stock + replenishment."""

from __future__ import annotations

import numpy as np

from adp_science.optimize.safety_stock import StockParams, order_up_to


def test_order_up_to_grows_with_service_level():
    p10 = np.array([1.0, 1.0, 1.0])
    p50 = np.array([2.0, 2.0, 2.0])
    p90 = np.array([3.0, 3.0, 3.0])
    _, _, s_low = order_up_to(p10, p50, p90, StockParams(lead_time_days=2, service_level=0.80))
    _, _, s_high = order_up_to(p10, p50, p90, StockParams(lead_time_days=2, service_level=0.99))
    assert s_high > s_low


def test_order_up_to_zero_uncertainty():
    p10 = np.array([2.0, 2.0])
    p50 = np.array([2.0, 2.0])
    p90 = np.array([2.0, 2.0])
    mu, sigma, S = order_up_to(p10, p50, p90, StockParams(lead_time_days=1, review_days=1))
    assert mu == 4.0
    assert sigma > 0  # we floor sigma per day at 1e-6, so sum > 0
    # S should be ~mu when uncertainty is tiny.
    assert abs(S - mu) < 0.01


def test_shelf_cap_bounds_S():
    p10 = np.array([1.0] * 10)
    p50 = np.array([2.0] * 10)
    p90 = np.array([10.0] * 10)
    params = StockParams(lead_time_days=2, review_days=2, max_shelf_days=2)
    _, _, S = order_up_to(p10, p50, p90, params)
    # Cap = p50 mean * (max_shelf_days / window) * window = p50 sum * max_shelf_days / window
    # = 8 * (2/4) = 4
    assert S <= 4.01
