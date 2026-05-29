/**
 * Tiny typed fetch wrapper for the backend API.
 *
 * Server components import this directly. We use `cache: "no-store"` because
 * forecasts get refreshed by a daily batch and we don't want stale UI between
 * runs. In production you'd swap that for `next: { revalidate: 3600 }`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type Sku = {
  sku_id: string;
  name: string;
  department: string;
  category: string;
  subcategory: string;
  pack_size: number;
  shelf_days: number;
  base_price: number;
  lead_time_days: number;
};

export type Store = {
  store_id: string;
  name: string;
  district: string;
  region: string;
  size_tier: string;
  open_date: string;
};

export type HistoryPoint = { date: string; units: number; on_promo: boolean };
export type ForecastPoint = {
  target_date: string;
  horizon_day: number;
  p10: number;
  p50: number;
  p90: number;
  p025: number;
  p975: number;
};

export type ForecastPayload = {
  store_id: string;
  sku_id: string;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
};

export type Recommendation = {
  order_date: string;
  arrival_date: string;
  store_id: string;
  sku_id: string;
  on_hand: number;
  suggested_qty: number;
  service_level: number;
  reason: string;
};

export type RecommendationSummary = {
  total_orders: number;
  total_units: number;
  by_store: { store_id: string; orders: number; units: number }[];
};

export type HealthPayload = {
  status: string;
  tables: Record<string, number>;
};

async function get<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as T;
}

export const api = {
  health: () => get<HealthPayload>("/health"),
  skus: () => get<Sku[]>("/catalog/skus"),
  stores: () => get<Store[]>("/catalog/stores"),
  forecast: (storeId: string, skuId: string) =>
    get<ForecastPayload>(
      `/forecasts/${encodeURIComponent(storeId)}/${encodeURIComponent(skuId)}`
    ),
  recommendations: (params: { store_id?: string; min_qty?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.store_id) q.set("store_id", params.store_id);
    if (params.min_qty != null) q.set("min_qty", String(params.min_qty));
    const qs = q.toString();
    return get<Recommendation[]>(`/recommendations${qs ? `?${qs}` : ""}`);
  },
  recommendationSummary: () =>
    get<RecommendationSummary>("/recommendations/summary"),
  accuracy: (groupBy: string) =>
    get<{ n: number; wape: number; bias: number; [k: string]: unknown }[]>(
      `/metrics/accuracy?group_by=${encodeURIComponent(groupBy)}`
    ),
};
