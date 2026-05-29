"""Tests for accuracy metrics."""

from __future__ import annotations

import math

import numpy as np

from adp_science.evaluate.metrics import bias, pinball, rmse, wape


def test_wape_zero_truth_is_nan():
    assert math.isnan(wape(np.zeros(5), np.ones(5)))


def test_wape_perfect_is_zero():
    y = np.array([1, 2, 3, 4])
    assert wape(y, y) == 0.0


def test_wape_known_value():
    y = np.array([10, 20, 30, 40])
    yhat = np.array([11, 19, 33, 38])
    # |1| + |1| + |3| + |2| = 7; sum(|y|) = 100; WAPE = 0.07
    assert math.isclose(wape(y, yhat), 0.07, abs_tol=1e-12)


def test_bias_sign():
    y = np.array([1, 1, 1, 1])
    over = np.array([2, 2, 2, 2])
    under = np.array([0, 0, 0, 0])
    assert bias(y, over) > 0
    assert bias(y, under) < 0


def test_rmse_known():
    y = np.array([0, 0, 0])
    yhat = np.array([1, 1, 1])
    assert math.isclose(rmse(y, yhat), 1.0)


def test_pinball_symmetric_at_median():
    y = np.array([1.0, 2.0, 3.0])
    yhat = np.array([2.0, 2.0, 2.0])
    # At q=0.5, pinball = 0.5 * MAE
    expected = 0.5 * np.mean(np.abs(y - yhat))
    assert math.isclose(pinball(y, yhat, 0.5), expected, rel_tol=1e-12)
