// Live analytics SSE stream — pushes real-time dashboard metrics every 10s.
// GET /api/analytics/live
//
// Events: { type: "snapshot", data: { open, escalated, online_agents, ... } }
// Reconnect on disconnect — the stream is stateless.

import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { AGENT_STATUS } from "@/app/api/agents/[id]/status/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSnapshot(tenantId: string) {
  const [convResult, msgResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS open_count,
         COUNT(*) FILTER (WHERE status = 'escalated') AS escalated_count,
         COUNT(*) FILTER (WHERE status = 'closed' AND updated_at >= NOW() - INTERVAL '1 hour') AS closed_last_hour,
         AVG(EXTRACT(EPOCH FROM (updated_at::timestamptz - created_at::timestamptz)) / 60)
           FILTER (WHERE status = 'closed' AND updated_at >= NOW() - INTERVAL '24 hours') AS avg_handle_time_mins
       FROM conversations
       WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => ({ rows: [{}] })),
    query(
      `SELECT COUNT(*) AS msg_count
       FROM messages
       WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [tenantId]
    ).catch(() => ({ rows: [{ msg_count: 0 }] })),
  ]);

  const conv = convResult.rows[0] ?? {};
  const msg = msgResult.rows[0] ?? {};

  // Count online agents from in-process map
  const now = Date.now();
  let onlineAgents = 0;
  for (const [, v] of AGENT_STATUS) {
    if (v.status === "online" || v.status === "busy") onlineAgents++;
  }

  return {
    open_conversations: Number(conv.open_count ?? 0),
    escalated_conversations: Number(conv.escalated_count ?? 0),
    closed_last_hour: Number(conv.closed_last_hour ?? 0),
    avg_handle_time_mins: Number(conv.avg_handle_time_mins ?? 0),
    messages_last_hour: Number(msg.msg_count ?? 0),
    online_agents: onlineAgents,
    sampled_at: new Date(now).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(data: object) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* connection closed */ }
      }

      async function tick() {
        if (closed) return;
        try {
          const snapshot = await fetchSnapshot(tenantId);
          send({ type: "snapshot", data: snapshot });
        } catch { /* non-fatal */ }
      }

      // Send immediately
      tick();
      // Then every 10 seconds
      const interval = setInterval(tick, 10_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
