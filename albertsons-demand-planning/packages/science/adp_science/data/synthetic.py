"""Synthetic grocery demand generator.

Designed to look enough like real Albertsons-style data that the rest of the
pipeline is exercised meaningfully. The model under the data:

  units ~ NegBinom(mean = mu, dispersion = phi)
  mu    = base_velocity
        * dow_effect[dow]
        * annual_seasonality(doy)
        * holiday_effect(date)
        * promo_lift(on_promo, depth)
        * store_size_effect[size_tier]
        * trend(date)

Negative binomial gives us the over-dispersion and zero-inflation that real
grocery POS data exhibits, without resorting to a separate zero-inflation step.

The output is three parquet files in `out_dir`:
- sales.parquet   - the long fact table
- skus.parquet    - SKU dimension
- stores.parquet  - store dimension
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import holidays as _holidays
    _US_HOLIDAYS = _holidays.UnitedStates()
except Exception:  # pragma: no cover - allow running without `holidays`
    _US_HOLIDAYS = {}


@dataclass(frozen=True)
class GenSpec:
    n_stores: int = 10
    n_skus_per_subcategory: int = 4
    start: date = date(2024, 1, 1)
    end: date = date(2025, 12, 31)
    seed: int = 7


# Hierarchy fixtures - just enough to be plausible without hand-typing 1000 SKUs.
_CATALOG: dict[str, dict[str, list[str]]] = {
    "Fresh": {
        "Bakery": ["Bread", "Pastries"],
        "Produce": ["Apples", "Bananas", "Salad"],
        "Meat": ["Chicken", "Beef"],
        "Dairy": ["Milk", "Yogurt", "Cheese"],
    },
    "Ambient": {
        "Pantry": ["Pasta", "Cereal", "Soup"],
        "Snacks": ["Chips", "Cookies"],
        "Beverages": ["Soda", "Water", "Juice"],
    },
    "Frozen": {
        "FrozenMeals": ["Pizza", "Entrees"],
        "IceCream": ["Pints", "Bars"],
    },
}

_SIZE_TIERS = {"S": 0.7, "M": 1.0, "L": 1.4}
_REGIONS = {
    "West": ["Norcal", "Socal", "Northwest"],
    "Mountain": ["Rockies", "Southwest"],
    "Central": ["Plains", "Texas"],
}


def _make_skus(spec: GenSpec, rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    for dept, cats in _CATALOG.items():
        for cat, subs in cats.items():
            for sub in subs:
                perish = 3 if dept == "Fresh" else (14 if dept == "Frozen" else 365)
                lead = 1 if dept == "Fresh" else (2 if dept == "Frozen" else 3)
                for i in range(spec.n_skus_per_subcategory):
                    sku_id = f"{sub[:3].upper()}-{i + 1:03d}"
                    price = float(np.round(rng.uniform(1.5, 12.0), 2))
                    pack = int(rng.choice([1, 1, 1, 6, 12]))
                    rows.append(
                        dict(
                            sku_id=sku_id,
                            name=f"{sub} #{i + 1}",
                            department=dept,
                            category=cat,
                            subcategory=sub,
                            pack_size=pack,
                            shelf_days=perish,
                            base_price=price,
                            lead_time_days=lead,
                        )
                    )
    df = pd.DataFrame(rows)
    # SKU ids may collide across subcategories with the same first-3-letters; disambiguate.
    df["sku_id"] = df.groupby("sku_id").cumcount().astype(str).radd(
        df["sku_id"].astype(str) + "-"
    )
    # Trim trailing -0 so the first one stays clean.
    df["sku_id"] = df["sku_id"].str.replace(r"-0$", "", regex=True)
    return df


def _make_stores(spec: GenSpec, rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    region_list = list(_REGIONS.items())
    for i in range(spec.n_stores):
        region, districts = region_list[i % len(region_list)]
        district = districts[i % len(districts)]
        tier = str(rng.choice(list(_SIZE_TIERS.keys()), p=[0.25, 0.5, 0.25]))
        rows.append(
            dict(
                store_id=f"S-{100 + i:03d}",
                name=f"Albertsons #{100 + i}",
                district=district,
                region=region,
                size_tier=tier,
                open_date=(spec.start - timedelta(days=int(rng.integers(365, 365 * 10)))),
            )
        )
    return pd.DataFrame(rows)


def _dow_effects(rng: np.random.Generator) -> np.ndarray:
    # Mon..Sun, mildly higher on Fri-Sun. Per-category we perturb this.
    base = np.array([0.85, 0.85, 0.9, 1.0, 1.2, 1.4, 1.2])
    return base * rng.uniform(0.9, 1.1, size=7)


def _annual_seasonality(doys: np.ndarray, phase: float, amp: float) -> np.ndarray:
    return 1.0 + amp * np.sin(2 * math.pi * (doys / 365.25) + phase)


def _holiday_effect(d: date) -> float:
    if d in _US_HOLIDAYS:
        # Thanksgiving, Christmas, July 4 spike harder; standard fed holidays mild.
        name = str(_US_HOLIDAYS.get(d, "")).lower()
        if "thanksgiving" in name or "christmas" in name or "independence" in name:
            return 2.5
        return 1.3
    # Day before Thanksgiving / Christmas Eve - simple proxy.
    nxt = d + timedelta(days=1)
    if nxt in _US_HOLIDAYS:
        name = str(_US_HOLIDAYS.get(nxt, "")).lower()
        if "thanksgiving" in name or "christmas" in name:
            return 2.0
    return 1.0


def _negbinom(mean: np.ndarray, dispersion: float, rng: np.random.Generator) -> np.ndarray:
    """Sample from NegBinom parameterized by mean and dispersion (variance = mu + mu^2/k)."""
    mean = np.maximum(mean, 1e-6)
    k = max(dispersion, 1e-3)
    p = k / (k + mean)
    return rng.negative_binomial(k, p)


def generate(spec: GenSpec, out_dir: str | Path) -> dict[str, Path]:
    """Generate sales, sku, and store tables and write them to `out_dir`."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(spec.seed)
    skus = _make_skus(spec, rng)
    stores = _make_stores(spec, rng)

    dates = pd.date_range(spec.start, spec.end, freq="D")
    doys = dates.dayofyear.to_numpy()
    dows = dates.dayofweek.to_numpy()

    # Per-category DOW + annual seasonality - fresh skews weekend, ambient flatter.
    cat_dow: dict[str, np.ndarray] = {}
    cat_annual: dict[str, tuple[float, float]] = {}
    for cat in skus["category"].unique():
        cat_dow[cat] = _dow_effects(rng)
        amp = rng.uniform(0.05, 0.25)
        phase = rng.uniform(0, 2 * math.pi)
        cat_annual[cat] = (phase, amp)

    holiday_mult = np.array([_holiday_effect(d.date()) for d in dates])
    trend = 1.0 + np.linspace(0, 0.06, num=len(dates))  # mild growth across panel

    frames: list[pd.DataFrame] = []
    for _, store in stores.iterrows():
        size_mult = _SIZE_TIERS[store["size_tier"]]
        for _, sku in skus.iterrows():
            base_v = rng.gamma(shape=2.0, scale=2.0) + 0.5  # mean ~ 4.5 units/day
            base_v *= size_mult
            dispersion = float(rng.uniform(0.5, 3.0))

            dow_effect = cat_dow[sku["category"]][dows]
            phase, amp = cat_annual[sku["category"]]
            seas = _annual_seasonality(doys, phase, amp)

            # Promo windows - randomly inject 6-day TPRs at ~10% of weeks.
            on_promo = np.zeros(len(dates), dtype=bool)
            promo_depth = np.zeros(len(dates))
            week_idx = (np.arange(len(dates)) // 7)
            promo_weeks = rng.random(week_idx.max() + 1) < 0.10
            for w in np.where(promo_weeks)[0]:
                start = int(w * 7)
                end = min(start + 6, len(dates))
                on_promo[start:end] = True
                promo_depth[start:end] = rng.uniform(0.10, 0.30)
            promo_mult = 1.0 + 4.0 * promo_depth * on_promo.astype(float)

            mu = base_v * dow_effect * seas * holiday_mult * trend * promo_mult
            units = _negbinom(mu, dispersion, rng)

            # Mild price elasticity even off-promo
            price = sku["base_price"] * (1.0 - 0.5 * promo_depth)
            revenue = units * price

            frames.append(
                pd.DataFrame(
                    {
                        "date": dates.date,
                        "store_id": store["store_id"],
                        "sku_id": sku["sku_id"],
                        "units": units.astype(np.int32),
                        "revenue": revenue.astype(np.float32),
                        "price": price.astype(np.float32),
                        "on_promo": on_promo,
                        "promo_depth": promo_depth.astype(np.float32),
                    }
                )
            )

    sales = pd.concat(frames, ignore_index=True)

    sales_path = out / "sales.parquet"
    skus_path = out / "skus.parquet"
    stores_path = out / "stores.parquet"

    sales.to_parquet(sales_path, index=False)
    skus.to_parquet(skus_path, index=False)
    stores.to_parquet(stores_path, index=False)

    return {"sales": sales_path, "skus": skus_path, "stores": stores_path}
