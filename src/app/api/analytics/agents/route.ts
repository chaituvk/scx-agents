// Agent performance analytics.
// GET /api/analytics/agents?days=30
//
// Returns per-agent metrics: conversations handled, avg response time,
// CSAT score, resolution rate, escalation rate, token usage.

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
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Conversations per agent (assigned_to field)
  const convResult = await query(
    `SELECT
       assigned_to AS agent_id,
       COUNT(*) AS total_conversations,
       COUNT(*) FILTER (WHERE status = 'closed') AS resolved,
       COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
       AVG(EXTRACT(EPOCH FROM (updated_at::timestamptz - created_at::timestamptz)) / 60) AS avg_handle_time_mins
     FROM conversations
     WHERE tenant_id = $1 AND created_at >= $2 AND assigned_to IS NOT NULL
     GROUP BY assigned_to
     ORDER BY total_conversations DESC`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // CSAT per agent
  const csatResult = await query(
    `SELECT c.agent_id, AVG(c.score) AS avg_csat, COUNT(*) AS csat_count
     FROM csat_ratings c
     JOIN conversations cv ON cv.id = c.conversation_id
     WHERE cv.tenant_id = $1 AND c.submitted_at >= $2 AND c.agent_id IS NOT NULL
     GROUP BY c.agent_id`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Token usage per agent_type
  const tokenResult = await query(
    `SELECT agent_type, SUM(total_tokens) AS total_tokens, SUM(cost_usd) AS total_cost_usd, COUNT(*) AS call_count
     FROM token_usage
     WHERE tenant_id = $1 AND created_at >= $2
     GROUP BY agent_type
     ORDER BY total_tokens DESC`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Merge by agent_id
  const csatMap = new Map(
    csatResult.rows.map(r => [r.agent_id as string, { avg_csat: Number(r.avg_csat), csat_count: Number(r.csat_count) }])
  );

  const agents = convResult.rows.map(r => ({
    agent_id: r.agent_id as string,
    total_conversations: Number(r.total_conversations),
    resolved: Number(r.resolved),
    escalated: Number(r.escalated),
    resolution_rate: Number(r.total_conversations) > 0
      ? (Number(r.resolved) / Number(r.total_conversations))
      : 0,
    escalation_rate: Number(r.total_conversations) > 0
      ? (Number(r.escalated) / Number(r.total_conversations))
      : 0,
    avg_handle_time_mins: Number(r.avg_handle_time_mins ?? 0),
    ...csatMap.get(r.agent_id as string) ?? { avg_csat: null, csat_count: 0 },
  }));

  return NextResponse.json({
    period_days: days,
    since,
    agents,
    token_usage_by_sub_agent: tokenResult.rows.map(r => ({
      agent_type: r.agent_type,
      total_tokens: Number(r.total_tokens),
      total_cost_usd: Number(r.total_cost_usd),
      call_count: Number(r.call_count),
    })),
  });
}
