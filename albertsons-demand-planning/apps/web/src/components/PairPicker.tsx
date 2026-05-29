"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { Sku, Store } from "@/lib/api";

export function PairPicker({
  stores,
  skus,
  current,
}: {
  stores: Store[];
  skus: Sku[];
  current: { store_id: string; sku_id: string };
}) {
  const router = useRouter();
  const search = useSearchParams();

  function go(next: { store_id?: string; sku_id?: string }) {
    const params = new URLSearchParams(search.toString());
    if (next.store_id) params.set("store_id", next.store_id);
    if (next.sku_id) params.set("sku_id", next.sku_id);
    router.push(`/forecasts?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
        Store
      </label>
      <select
        value={current.store_id}
        onChange={(e) => go({ store_id: e.target.value })}
        className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
      >
        {stores.map((s) => (
          <option key={s.store_id} value={s.store_id}>
            {s.store_id} — {s.name}
          </option>
        ))}
      </select>
      <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
        SKU
      </label>
      <select
        value={current.sku_id}
        onChange={(e) => go({ sku_id: e.target.value })}
        className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
      >
        {skus.map((s) => (
          <option key={s.sku_id} value={s.sku_id}>
            {s.sku_id} — {s.name} ({s.category})
          </option>
        ))}
      </select>
    </div>
  );
}
