import { ForecastChart } from "@/components/ForecastChart";
import { PairPicker } from "@/components/PairPicker";
import { api } from "@/lib/api";

type SP = Promise<{ store_id?: string; sku_id?: string }>;

export default async function ForecastsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const [stores, skus] = await Promise.all([api.stores(), api.skus()]);
  const storeId = sp.store_id ?? stores[0]?.store_id;
  const skuId = sp.sku_id ?? skus[0]?.sku_id;

  let payload: Awaited<ReturnType<typeof api.forecast>> | null = null;
  let errMsg: string | null = null;
  if (storeId && skuId) {
    try {
      payload = await api.forecast(storeId, skuId);
    } catch (e) {
      errMsg = String((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Forecast explorer</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        90 days of history followed by the latest model horizon, with 80% and
        95% prediction intervals.
      </p>

      <div className="mt-4">
        <PairPicker
          stores={stores}
          skus={skus}
          current={{ store_id: storeId ?? "", sku_id: skuId ?? "" }}
        />
      </div>

      <div className="mt-6">
        {errMsg ? (
          <div className="rounded-md border border-[var(--negative)]/30 bg-[var(--negative)]/10 p-4 text-sm">
            {errMsg}
          </div>
        ) : payload ? (
          <ForecastChart payload={payload} />
        ) : (
          <div className="rounded-md border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            No forecast yet.
          </div>
        )}
      </div>
    </div>
  );
}
