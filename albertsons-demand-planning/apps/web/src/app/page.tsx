import Link from "next/link";

import { KpiCard } from "@/components/KpiCard";
import { api } from "@/lib/api";

export default async function HomePage() {
  // Server-side fetch. If the API isn't reachable we render a friendly empty state.
  let summary: Awaited<ReturnType<typeof api.recommendationSummary>> | null = null;
  let health: Awaited<ReturnType<typeof api.health>> | null = null;
  let errMsg: string | null = null;
  try {
    [summary, health] = await Promise.all([
      api.recommendationSummary(),
      api.health(),
    ]);
  } catch (e) {
    errMsg = String((e as Error).message);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Snapshot of today&apos;s replenishment recommendations and the data
        powering them.
      </p>

      {errMsg ? (
        <div className="mt-6 rounded-md border border-[var(--negative)]/30 bg-[var(--negative)]/10 p-4 text-sm">
          Couldn&apos;t reach the API at{" "}
          <code>{process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"}</code>.
          Make sure you&apos;ve run <code>make data train forecast replenish api</code>.
          <div className="mt-2 text-xs opacity-70">{errMsg}</div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Orders suggested"
              value={summary!.total_orders.toLocaleString()}
              sub="across all stores"
            />
            <KpiCard
              label="Total units"
              value={summary!.total_units.toLocaleString()}
              sub="open order qty"
            />
            <KpiCard
              label="Stores"
              value={summary!.by_store.length}
              sub="with active recs"
            />
            <KpiCard
              label="Forecast rows"
              value={(health?.tables.forecast_rows ?? 0).toLocaleString()}
              sub="last batch"
            />
          </div>

          <h2 className="mt-10 text-lg font-semibold">Orders by store</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2">Store</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {summary!.by_store.map((row) => (
                  <tr key={row.store_id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">
                      <Link
                        className="hover:underline"
                        href={`/replenishment?store_id=${row.store_id}`}
                      >
                        {row.store_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
