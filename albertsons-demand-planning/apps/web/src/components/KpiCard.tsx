type Props = {
  label: string;
  value: string | number;
  sub?: string;
};

export function KpiCard({ label, value, sub }: Props) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {sub ? (
        <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div>
      ) : null}
    </div>
  );
}
