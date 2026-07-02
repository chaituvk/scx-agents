// Conversation trend analytics.
// GET /api/analytics/conversations?days=30&granularity=day
//
// Returns time-series conversation volume, resolution rate, sentiment
// distribution, and channel breakdown. Granularity: hour | day | week.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10)));
  const granularity = searchParams.get("granularity") ?? "day";
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Time-truncation expression per granularity
  const trunc = granularity === "hour"
    ? "date_trunc('hour', created_at::timestamptz)"
    : granularity === "week"
    ? "date_trunc('week', created_at::timestamptz)"
    : "date_trunc('day', created_at::timestamptz)";

  // Volume by period
  const volumeResult = await query(
    `SELECT ${trunc} AS period,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'closed') AS resolved,
       COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
       COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive,
       COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral,
       COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative
     FROM conversations
     WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY period
     ORDER BY period ASC`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Channel breakdown
  const channelResult = await query(
    `SELECT channel, COUNT(*) AS total
     FROM conversations
     WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY channel
     ORDER BY total DESC`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Intent breakdown (from messages table)
  const intentResult = await query(
    `SELECT intent, COUNT(*) AS total
     FROM messages
     WHERE tenant_id = $1 AND created_at >= $2 AND intent IS NOT NULL
     GROUP BY intent
     ORDER BY total DESC
     LIMIT 20`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  const series = volumeResult.rows.map(r => ({
    period: r.period,
    total: Number(r.total),
    resolved: Number(r.resolved),
    escalated: Number(r.escalated),
    resolution_rate: Number(r.total) > 0 ? Number(r.resolved) / Number(r.total) : 0,
    sentiment: {
      positive: Number(r.positive),
      neutral: Number(r.neutral),
      negative: Number(r.negative),
    },
  }));

  return NextResponse.json({
    period_days: days,
    granularity,
    since,
    series,
    channels: channelResult.rows.map(r => ({ channel: r.channel, total: Number(r.total) })),
    top_intents: intentResult.rows.map(r => ({ intent: r.intent, total: Number(r.total) })),
  });
}
