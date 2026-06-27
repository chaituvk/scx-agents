// Scheduled digest report — generate and email a performance summary.
// POST /api/reports/digest
// Body: { period: "daily" | "weekly", recipients?: string[] }
//
// Computes KPIs for the selected period and sends via email adapter.
// Can also be called directly by an external cron (e.g. GitHub Actions).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { sendEmail } from "@/lib/integrations/adapters/email";

export const runtime = "nodejs";

async function computeKpis(tenantId: string, since: string) {
  const [convResult, csatResult, tokenResult, escalResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'closed') AS resolved,
         COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
         COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive,
         COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative,
         AVG(EXTRACT(EPOCH FROM (updated_at::timestamptz - created_at::timestamptz)) / 60)
           FILTER (WHERE status = 'closed') AS avg_handle_mins
       FROM conversations WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, since]
    ).catch(() => ({ rows: [{}] })),
    query(
      `SELECT AVG(score) AS avg_csat, COUNT(*) AS count FROM csat_ratings cr
       JOIN conversations c ON cr.conversation_id = c.id
       WHERE c.tenant_id = $1 AND cr.submitted_at >= $2`,
      [tenantId, since]
    ).catch(() => ({ rows: [{}] })),
    query(
      `SELECT SUM(total_tokens) AS tokens, SUM(cost_usd) AS cost
       FROM token_usage WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, since]
    ).catch(() => ({ rows: [{}] })),
    query(
      `SELECT COUNT(*) AS open_gaps FROM knowledge_gaps
       WHERE tenant_id = $1 AND status = 'open' AND created_at >= $2`,
      [tenantId, since]
    ).catch(() => ({ rows: [{ open_gaps: 0 }] })),
  ]);

  const c = convResult.rows[0] ?? {};
  const s = csatResult.rows[0] ?? {};
  const t = tokenResult.rows[0] ?? {};
  const e = escalResult.rows[0] ?? {};

  return {
    total_conversations: Number(c.total ?? 0),
    resolved: Number(c.resolved ?? 0),
    escalated: Number(c.escalated ?? 0),
    positive_sentiment: Number(c.positive ?? 0),
    negative_sentiment: Number(c.negative ?? 0),
    avg_handle_mins: Number(c.avg_handle_mins ?? 0),
    resolution_rate: Number(c.total ?? 0) > 0 ? Number(c.resolved ?? 0) / Number(c.total ?? 0) : 0,
    avg_csat: s.avg_csat ? Number(s.avg_csat) : null,
    csat_count: Number(s.count ?? 0),
    total_tokens: Number(t.tokens ?? 0),
    total_cost_usd: Number(t.cost ?? 0),
    open_knowledge_gaps: Number(e.open_gaps ?? 0),
  };
}

function buildHtmlReport(kpis: ReturnType<typeof computeKpis> extends Promise<infer T> ? T : never, period: string, since: string): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
.container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.header { background: #111827; padding: 24px 32px; }
.header h1 { color: #fff; margin: 0; font-size: 20px; }
.header p { color: #9ca3af; margin: 4px 0 0; font-size: 13px; }
.body { padding: 32px; }
.kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
.kpi .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.kpi .value { font-size: 24px; font-weight: 700; color: #111827; }
.kpi .sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>Sierra AI — ${period === "weekly" ? "Weekly" : "Daily"} Digest</h1>
    <p>Period: ${since.slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}</p>
  </div>
  <div class="body">
    <div class="kpi-grid">
      <div class="kpi"><div class="label">Conversations</div><div class="value">${kpis.total_conversations}</div></div>
      <div class="kpi"><div class="label">Resolution Rate</div><div class="value">${pct(kpis.resolution_rate)}</div><div class="sub">${kpis.resolved} resolved</div></div>
      <div class="kpi"><div class="label">CSAT Score</div><div class="value">${kpis.avg_csat ? kpis.avg_csat.toFixed(1) + " / 5" : "—"}</div><div class="sub">${kpis.csat_count} ratings</div></div>
      <div class="kpi"><div class="label">Avg Handle Time</div><div class="value">${kpis.avg_handle_mins.toFixed(0)}m</div></div>
      <div class="kpi"><div class="label">Escalations</div><div class="value">${kpis.escalated}</div></div>
      <div class="kpi"><div class="label">AI Cost</div><div class="value">$${kpis.total_cost_usd.toFixed(2)}</div><div class="sub">${(kpis.total_tokens / 1000).toFixed(0)}k tokens</div></div>
    </div>
    ${kpis.open_knowledge_gaps > 0 ? `<p style="color:#b45309;background:#fef3c7;border-radius:6px;padding:10px 14px;font-size:13px;">⚠️ ${kpis.open_knowledge_gaps} unanswered questions in knowledge gaps — consider adding content to your knowledge base.</p>` : ""}
    <p style="font-size:12px;color:#6b7280;">Sentiment this period: ${kpis.positive_sentiment} positive, ${kpis.negative_sentiment} negative out of ${kpis.total_conversations} conversations.</p>
  </div>
  <div class="footer">Sierra AI Platform · Automated digest · Do not reply</div>
</div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: { period?: string; recipients?: string[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const period = body.period === "weekly" ? "weekly" : "daily";
  const dayMs = 86_400_000;
  const since = new Date(Date.now() - (period === "weekly" ? 7 : 1) * dayMs).toISOString();

  const kpis = await computeKpis(tenantId, since);

  const subject = `Sierra AI ${period === "weekly" ? "Weekly" : "Daily"} Digest — ${new Date().toISOString().slice(0, 10)}`;
  const html = buildHtmlReport(kpis, period, since);

  // Send to specified recipients or fall back to console
  const recipients = body.recipients ?? [];
  const emailsSent: string[] = [];

  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, htmlBody: html, textBody: `Sierra digest for ${period} period. Conversations: ${kpis.total_conversations}, Resolution rate: ${(kpis.resolution_rate * 100).toFixed(1)}%` });
      emailsSent.push(to);
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({
    ok: true,
    period,
    since,
    kpis,
    emails_sent: emailsSent,
    html_preview: recipients.length === 0 ? html : undefined,
  });
}

// GET — preview the digest without sending
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") === "weekly" ? "weekly" : "daily";
  const since = new Date(Date.now() - (period === "weekly" ? 7 : 1) * 86_400_000).toISOString();

  const kpis = await computeKpis(tenantId, since);
  return NextResponse.json({ period, since, kpis });
}
