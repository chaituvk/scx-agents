import { api } from "@/lib/api";

type SP = Promise<{ group_by?: string }>;

const GROUPS = ["horizon_day", "store_id", "sku_id"];

export default async function AccuracyPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const groupBy = sp.group_by ?? "horizon_day";
  let rows: Awaited<ReturnType<typeof api.accuracy>> = [];
  let errMsg: string | null = null;
  try {
    rows = await api.accuracy(groupBy);
  } catch (e) {
    errMsg = String((e as Error).message);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Forecast accuracy</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Rolling-origin backtest. WAPE is the primary KPI; bias should be near
        zero (positive = over-forecast).
      </p>

      <form className="mt-4 flex items-center gap-2" action="/accuracy">
        <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Group by
        </label>
        <select
          name="group_by"
          defaultValue={groupBy}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black"
        >
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-[var(--border)]">
        {errMsg ? (
          <div className="p-4 text-sm text-[var(--muted)]">{errMsg}</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)]">
            No accuracy data. Run <code>python -m adp_science.pipelines.backtest --sales ...</code>
            then restart the API.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2">{groupBy}</th>
                <th className="px-4 py-2 text-right">n</th>
                <th className="px-4 py-2 text-right">WAPE</th>
                <th className="px-4 py-2 text-right">bias</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">{String(r[groupBy] ?? "")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.n}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {(r.wape * 100).toFixed(1)}%
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums"
                    style={{
                      color:
                        r.bias > 0
                          ? "var(--negative)"
                          : r.bias < 0
                          ? "var(--positive)"
                          : undefined,
                    }}
                  >
                    {(r.bias * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
