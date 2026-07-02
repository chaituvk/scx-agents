import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";
import { isPostgres } from "@/lib/db";

export interface Insight {
  id: string;
  tenant_id?: string;
  date: string;
  metric: string;
  value: number;
  category?: string;
  created_at?: string;
}

class InsightRepo extends Repository<Insight> {
  constructor() {
    super("insights", 300);
  }

  async findById(id: string): Promise<Insight | null> {
    const row = await getOne("SELECT * FROM insights WHERE id = $1", [id]);
    return row as Insight | null;
  }

  async findByConversation(conversationId: string): Promise<Insight[]> {
    const result = await query("SELECT * FROM insights WHERE conversation_id = $1 ORDER BY created_at DESC", [conversationId]);
    return result.rows as Insight[];
  }

  async findAll(tenantId?: string): Promise<Insight[]> {
    const result = tenantId
      ? await query("SELECT * FROM insights WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM insights ORDER BY created_at DESC LIMIT 200");
    return result.rows as Insight[];
  }

  async create(data: Omit<Insight, "id" | "created_at"> & { id?: string }): Promise<Insight> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO insights (id, tenant_id, date, metric, value, category, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.tenant_id ?? "r-mobile", data.date, data.metric, data.value, data.category ?? null, now]
    );

    return { ...data, id, created_at: now } as Insight;
  }

  async update(id: string, data: Partial<Insight>): Promise<Insight | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && k !== "id" && k !== "created_at") {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE insights SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM insights WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }

  async computeAvgResponseTime(tenantId: string): Promise<number> {
    // Match turn_end events with corresponding turn_start events by conversation_id
    // from the last 30 days, and average the difference in seconds.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    if (isPostgres()) {
      // PostgreSQL: ts is TIMESTAMPTZ, use EXTRACT(EPOCH ...) for diff in seconds
      const row = await getOne(
        `SELECT AVG(EXTRACT(EPOCH FROM (e.ts - s.ts))) AS avg_seconds
         FROM audit_events e
         JOIN audit_events s
           ON s.conversation_id = e.conversation_id
          AND s.tenant_id = e.tenant_id
          AND s.type = 'turn_start'
         WHERE e.tenant_id = $1
           AND e.type = 'turn_end'
           AND e.ts >= $2`,
        [tenantId, thirtyDaysAgo]
      );
      const val = parseFloat(row?.avg_seconds ?? "0");
      return Number.isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : 0;
    } else {
      // SQLite: ts is stored as ISO string text, use strftime to convert
      const row = await getOne(
        `SELECT AVG(
           (strftime('%s', e.ts) - strftime('%s', s.ts))
         ) AS avg_seconds
         FROM audit_events e
         JOIN audit_events s
           ON s.conversation_id = e.conversation_id
          AND s.tenant_id = e.tenant_id
          AND s.type = 'turn_start'
         WHERE e.tenant_id = $1
           AND e.type = 'turn_end'
           AND e.ts >= $2`,
        [tenantId, thirtyDaysAgo]
      );
      const val = parseFloat(row?.avg_seconds ?? "0");
      return Number.isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : 0;
    }
  }
}

export const insightRepo = new InsightRepo();
