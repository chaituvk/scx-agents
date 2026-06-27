// Playbook performance analytics.
// GET /api/analytics/playbooks?days=30
//
// Returns per-playbook metrics: conversations handled, completion rate,
// escalation rate, avg turns, CSAT score, sentiment distribution.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "playbooks", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Playbook usage from playbook_states
  const usageResult = await query(
    `SELECT ps.playbook_id,
       COUNT(DISTINCT ps.conversation_id) AS conversations,
       AVG(ps.turn_count) AS avg_turns
     FROM playbook_states ps
     JOIN conversations c ON c.id = ps.conversation_id
     WHERE c.tenant_id = $1 AND c.created_at >= $2
     GROUP BY ps.playbook_id`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Conversation outcomes by playbook
  const outcomeResult = await query(
    `SELECT ps.playbook_id,
       COUNT(*) FILTER (WHERE c.status = 'closed') AS resolved,
       COUNT(*) FILTER (WHERE c.status = 'escalated') AS escalated,
       COUNT(*) FILTER (WHERE c.sentiment = 'positive') AS positive_sentiment,
       COUNT(*) FILTER (WHERE c.sentiment = 'negative') AS negative_sentiment,
       COUNT(*) FILTER (WHERE c.sentiment = 'neutral') AS neutral_sentiment
     FROM playbook_states ps
     JOIN conversations c ON c.id = ps.conversation_id
     WHERE c.tenant_id = $1 AND c.created_at >= $2
     GROUP BY ps.playbook_id`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // CSAT by playbook
  const csatResult = await query(
    `SELECT ps.playbook_id, AVG(cr.score) AS avg_csat, COUNT(*) AS csat_count
     FROM playbook_states ps
     JOIN csat_ratings cr ON cr.conversation_id = ps.conversation_id
     JOIN conversations c ON c.id = ps.conversation_id
     WHERE c.tenant_id = $1 AND cr.submitted_at >= $2
     GROUP BY ps.playbook_id`,
    [tenantId, since]
  ).catch(() => ({ rows: [] }));

  // Merge
  const outcomeMap = new Map(outcomeResult.rows.map(r => [r.playbook_id as string, r]));
  const csatMap = new Map(csatResult.rows.map(r => [r.playbook_id as string, { avg_csat: Number(r.avg_csat), csat_count: Number(r.csat_count) }]));

  const playbooks = usageResult.rows.map(r => {
    const pid = r.playbook_id as string;
    const outcome = outcomeMap.get(pid) ?? {};
    const total = Number(r.conversations);
    const resolved = Number((outcome as Record<string, unknown>).resolved ?? 0);
    const escalated = Number((outcome as Record<string, unknown>).escalated ?? 0);
    return {
      playbook_id: pid,
      conversations: total,
      avg_turns: Number(r.avg_turns ?? 0),
      resolution_rate: total > 0 ? resolved / total : 0,
      escalation_rate: total > 0 ? escalated / total : 0,
      sentiment: {
        positive: Number((outcome as Record<string, unknown>).positive_sentiment ?? 0),
        neutral: Number((outcome as Record<string, unknown>).neutral_sentiment ?? 0),
        negative: Number((outcome as Record<string, unknown>).negative_sentiment ?? 0),
      },
      ...csatMap.get(pid) ?? { avg_csat: null, csat_count: 0 },
    };
  });

  return NextResponse.json({ period_days: days, since, playbooks });
}
