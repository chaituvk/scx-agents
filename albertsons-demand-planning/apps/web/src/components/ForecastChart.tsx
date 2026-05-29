"use client";

import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ForecastPayload } from "@/lib/api";

type Row = {
  date: string;
  actual?: number;
  p50?: number;
  band80?: [number, number];
  band95?: [number, number];
};

/** Merge history + forecast into a single time series for the chart. */
function buildSeries(payload: ForecastPayload): Row[] {
  const rows: Row[] = [];
  for (const h of payload.history) {
    rows.push({ date: h.date, actual: h.units });
  }
  for (const f of payload.forecast) {
    rows.push({
      date: f.target_date,
      p50: f.p50,
      band80: [f.p10, f.p90],
      band95: [f.p025, f.p975],
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function ForecastChart({ payload }: { payload: ForecastPayload }) {
  const series = buildSeries(payload);
  const originDate = payload.forecast[0]?.target_date;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-2 text-sm text-[var(--muted)]">
        {payload.store_id} / {payload.sku_id}
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={series}>
          <XAxis dataKey="date" stroke="#98a2b3" minTickGap={28} />
          <YAxis stroke="#98a2b3" />
          <Tooltip
            contentStyle={{
              background: "#14181d",
              border: "1px solid #232a32",
              borderRadius: 6,
            }}
            labelStyle={{ color: "#e8eaed" }}
          />
          <Legend />
          {originDate ? (
            <ReferenceLine
              x={originDate}
              stroke="#ff7a00"
              strokeDasharray="3 3"
              label={{ value: "forecast origin", fill: "#ff7a00", fontSize: 10 }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="band95"
            stroke="none"
            fill="#ff7a00"
            fillOpacity={0.10}
            name="95% interval"
          />
          <Area
            type="monotone"
            dataKey="band80"
            stroke="none"
            fill="#ff7a00"
            fillOpacity={0.22}
            name="80% interval"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#e8eaed"
            dot={false}
            strokeWidth={2}
            name="actual"
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#ff7a00"
            dot={false}
            strokeWidth={2}
            name="forecast (p50)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
