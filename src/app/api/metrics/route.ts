import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { listTenants } from "@/lib/tenant";

// Prometheus text format helpers
function metricLine(name: string, labels: Record<string, string>, value: number): string {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`)
    .join(",");
  return `${name}{${labelStr}} ${value}`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.METRICS_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const tenants = listTenants();
    const tenantIds = tenants.map((t) => t.id);

    // Gather all metrics in parallel for all tenants
    const [
      convTotalRows,
      convOpenRows,
      msgTotalRows,
      auditTotalRows,
      knowledgeActiveRows,
    ] = await Promise.all([
      query(
        `SELECT tenant_id, COUNT(*) AS cnt FROM conversations WHERE tenant_id = ANY($1::text[]) GROUP BY tenant_id`,
        [tenantIds]
      ).catch(() =>
        query(
          `SELECT tenant_id, COUNT(*) AS cnt FROM conversations WHERE tenant_id IN (${tenantIds.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY tenant_id`,
          tenantIds
        )
      ),
      query(
        `SELECT tenant_id, COUNT(*) AS cnt FROM conversations WHERE tenant_id = ANY($1::text[]) AND status = 'open' GROUP BY tenant_id`,
        [tenantIds]
      ).catch(() =>
        query(
          `SELECT tenant_id, COUNT(*) AS cnt FROM conversations WHERE status = 'open' AND tenant_id IN (${tenantIds.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY tenant_id`,
          tenantIds
        )
      ),
      query(
        `SELECT tenant_id, COUNT(*) AS cnt FROM messages WHERE tenant_id = ANY($1::text[]) GROUP BY tenant_id`,
        [tenantIds]
      ).catch(() =>
        query(
          `SELECT tenant_id, COUNT(*) AS cnt FROM messages WHERE tenant_id IN (${tenantIds.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY tenant_id`,
          tenantIds
        )
      ),
      query(
        `SELECT tenant_id, COUNT(*) AS cnt FROM audit_events WHERE tenant_id = ANY($1::text[]) GROUP BY tenant_id`,
        [tenantIds]
      ).catch(() =>
        query(
          `SELECT tenant_id, COUNT(*) AS cnt FROM audit_events WHERE tenant_id IN (${tenantIds.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY tenant_id`,
          tenantIds
        )
      ),
      query(
        `SELECT tenant_id, COUNT(*) AS cnt FROM knowledge_sources WHERE tenant_id = ANY($1::text[]) AND status = 'active' GROUP BY tenant_id`,
        [tenantIds]
      ).catch(() =>
        query(
          `SELECT tenant_id, COUNT(*) AS cnt FROM knowledge_sources WHERE status = 'active' AND tenant_id IN (${tenantIds.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY tenant_id`,
          tenantIds
        )
      ),
    ]);

    // Build lookup maps keyed by tenant_id
    function toMap(rows: { tenant_id: string; cnt: string | number }[]): Map<string, number> {
      const m = new Map<string, number>();
      for (const row of rows) {
        m.set(row.tenant_id, Number(row.cnt));
      }
      return m;
    }

    const convTotal = toMap(convTotalRows.rows);
    const convOpen = toMap(convOpenRows.rows);
    const msgTotal = toMap(msgTotalRows.rows);
    const auditTotal = toMap(auditTotalRows.rows);
    const knowledgeActive = toMap(knowledgeActiveRows.rows);

    // Build Prometheus text output
    const lines: string[] = [
      "# HELP scx_conversations_total Total number of conversations per tenant",
      "# TYPE scx_conversations_total counter",
    ];
    for (const t of tenants) {
      lines.push(metricLine("scx_conversations_total", { tenant_id: t.id }, convTotal.get(t.id) ?? 0));
    }

    lines.push("");
    lines.push("# HELP scx_conversations_open Number of open conversations per tenant");
    lines.push("# TYPE scx_conversations_open gauge");
    for (const t of tenants) {
      lines.push(metricLine("scx_conversations_open", { tenant_id: t.id }, convOpen.get(t.id) ?? 0));
    }

    lines.push("");
    lines.push("# HELP scx_messages_total Total number of messages per tenant");
    lines.push("# TYPE scx_messages_total counter");
    for (const t of tenants) {
      lines.push(metricLine("scx_messages_total", { tenant_id: t.id }, msgTotal.get(t.id) ?? 0));
    }

    lines.push("");
    lines.push("# HELP scx_audit_events_total Total number of audit events per tenant");
    lines.push("# TYPE scx_audit_events_total counter");
    for (const t of tenants) {
      lines.push(metricLine("scx_audit_events_total", { tenant_id: t.id }, auditTotal.get(t.id) ?? 0));
    }

    lines.push("");
    lines.push("# HELP scx_knowledge_sources_active Number of active knowledge sources per tenant");
    lines.push("# TYPE scx_knowledge_sources_active gauge");
    for (const t of tenants) {
      lines.push(metricLine("scx_knowledge_sources_active", { tenant_id: t.id }, knowledgeActive.get(t.id) ?? 0));
    }

    // Trailing newline required by Prometheus exposition format
    lines.push("");
    const body = lines.join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
      },
    });
  } catch (err) {
    return new Response(`# scrape error: ${(err as Error).message}\n`, {
      status: 500,
      headers: { "Content-Type": "text/plain; version=0.0.4" },
    });
  }
}
