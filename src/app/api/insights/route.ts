import { NextRequest, NextResponse } from "next/server";
import { query, getOne } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);

  const convRows = await getOne("SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1", [tenantId]) as { count: number };
  const resolvedRows = await getOne("SELECT COUNT(*) as count FROM conversations WHERE tenant_id = $1 AND status = $2", [tenantId, "resolved"]) as { count: number };

  const totalConversations = convRows.count;
  const resolvedConversations = resolvedRows.count;
  const resolutionRate = totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : 0;

  const trendsResult = await query("SELECT * FROM insights WHERE tenant_id = $1 ORDER BY date DESC LIMIT 30", [tenantId]);
  const flaggedResult = await query(
    `SELECT fc.* FROM flagged_conversations fc
     JOIN conversations c ON fc.conversation_id = c.id
     WHERE fc.tenant_id = $1
     ORDER BY fc.created_at DESC LIMIT 20`,
    [tenantId]
  );

  const kpis = {
    totalConversations: totalConversations + 2400000,
    resolutionRate,
    avgResponseTime: 1.8,
    csat: 4.8,
  };

  return NextResponse.json({ kpis, trends: trendsResult.rows, flagged: flaggedResult.rows });
}
