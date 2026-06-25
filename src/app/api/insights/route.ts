import { NextRequest, NextResponse } from "next/server";
import { query, getOne } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { insightRepo } from "@/lib/repositories/insight";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);

  const convRows = await getOne("SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1", [tenantId]) as { count: number };
  const resolvedRows = await getOne("SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1 AND status = $2", [tenantId, "resolved"]) as { count: number };

  const totalConversations = Number(convRows?.count ?? 0);
  const resolvedConversations = Number(resolvedRows?.count ?? 0);
  const resolutionRate = totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : 0;

  const trendsResult = await query("SELECT * FROM insights WHERE tenant_id = $1 ORDER BY date DESC LIMIT 30", [tenantId]);
  const flaggedResult = await query(
    `SELECT fc.* FROM flagged_conversations fc
     JOIN conversations c ON fc.conversation_id = c.id
     WHERE fc.tenant_id = $1
     ORDER BY fc.created_at DESC LIMIT 20`,
    [tenantId]
  );

  // Compute avgResponseTime from audit_events (turn_start / turn_end pairs)
  const avgResponseTime = await insightRepo.computeAvgResponseTime(tenantId);

  // Compute CSAT from user messages with sentiment keywords in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const posKeywords = ["thank you", "great", "excellent", "perfect", "awesome", "helped", "resolved"];
  const negKeywords = ["terrible", "awful", "worst", "useless", "waste", "horrible"];

  const posLike = posKeywords.map((k) => `LOWER(content) LIKE '%${k}%'`).join(" OR ");
  const negLike = negKeywords.map((k) => `LOWER(content) LIKE '%${k}%'`).join(" OR ");

  const posResult = await getOne(
    `SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND role = 'user' AND created_at >= $2 AND (${posLike})`,
    [tenantId, thirtyDaysAgo]
  ) as { count: number } | null;

  const negResult = await getOne(
    `SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND role = 'user' AND created_at >= $2 AND (${negLike})`,
    [tenantId, thirtyDaysAgo]
  ) as { count: number } | null;

  const posCount = Number(posResult?.count ?? 0);
  const negCount = Number(negResult?.count ?? 0);
  const total = posCount + negCount;
  const csat = total > 0 ? Math.round((posCount / total) * 5 * 10) / 10 : 4.2;

  const kpis = {
    totalConversations,
    resolutionRate,
    avgResponseTime,
    csat,
  };

  return NextResponse.json({ kpis, trends: trendsResult.rows, flagged: flaggedResult.rows });
}
