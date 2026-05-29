import { api } from "@/lib/api";

type SP = Promise<{ store_id?: string; min_qty?: string }>;

export default async function ReplenishmentPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const minQty = sp.min_qty ? Number(sp.min_qty) : undefined;
  let rows: Awaited<ReturnType<typeof api.recommendations>> = [];
  let errMsg: string | null = null;
  try {
    rows = await api.recommendations({
      store_id: sp.store_id,
      min_qty: minQty,
    });
  } catch (e) {
    errMsg = String((e as Error).message);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Replenishment workbench</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Each row is one order the model is suggesting for arrival on the listed
        date. The rationale explains the safety stock math behind it.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-3" action="/replenishment">
        <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Store</label>
        <input
          name="store_id"
          placeholder="all"
          defaultValue={sp.store_id ?? ""}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
        />
        <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Min qty</label>
        <input
          name="min_qty"
          type="number"
          min={0}
          defaultValue={sp.min_qty ?? ""}
          className="w-24 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-[var(--border)]">
        {errMsg ? (
          <div className="p-4 text-sm text-[var(--muted)]">{errMsg}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">Order date</th>
                <th className="px-4 py-2">Arrival</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Suggested qty</th>
                <th className="px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-2 tabular-nums">{r.order_date}</td>
                  <td className="px-4 py-2 tabular-nums">{r.arrival_date}</td>
                  <td className="px-4 py-2">{r.store_id}</td>
                  <td className="px-4 py-2">{r.sku_id}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.on_hand}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {r.suggested_qty}
                  </td>
                  <td className="px-4 py-2 text-xs text-[var(--muted)]">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
