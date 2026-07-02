import { query, getOne, run } from "@/lib/db";
import { randomUUID } from "crypto";

export interface ProactiveTrigger {
  id: string;
  tenant_id: string;
  name: string;
  status: "active" | "inactive";
  trigger_type: "page_dwell" | "exit_intent" | "scroll_depth" | "return_visitor" | "custom";
  conditions: {
    url_pattern?: string;
    scroll_percent?: number;
    dwell_seconds?: number;
    visit_count_min?: number;
    visit_count_max?: number;
    hour_start?: number;
    hour_end?: number;
    [key: string]: unknown;
  };
  message: string;
  playbook_id?: string;
  delay_seconds: number;
  cooldown_hours: number;
  priority: number;
  created_at?: string;
  updated_at?: string;
}

function parseRow(row: Record<string, unknown>): ProactiveTrigger {
  if (typeof row.conditions === "string") {
    try { row.conditions = JSON.parse(row.conditions as string); } catch { row.conditions = {}; }
  }
  return row as unknown as ProactiveTrigger;
}

export const proactiveTriggerRepo = {
  async findAll(tenantId: string): Promise<ProactiveTrigger[]> {
    const result = await query(
      "SELECT * FROM proactive_triggers WHERE tenant_id = $1 ORDER BY priority ASC, created_at DESC",
      [tenantId]
    );
    return result.rows.map(r => parseRow(r as Record<string, unknown>));
  },

  async findActive(tenantId: string): Promise<ProactiveTrigger[]> {
    const result = await query(
      "SELECT * FROM proactive_triggers WHERE tenant_id = $1 AND status = 'active' ORDER BY priority ASC",
      [tenantId]
    );
    return result.rows.map(r => parseRow(r as Record<string, unknown>));
  },

  async findById(id: string): Promise<ProactiveTrigger | null> {
    const row = await getOne("SELECT * FROM proactive_triggers WHERE id = $1", [id]);
    return row ? parseRow(row as Record<string, unknown>) : null;
  },

  async create(tenantId: string, data: Omit<ProactiveTrigger, "id" | "tenant_id" | "created_at" | "updated_at">): Promise<ProactiveTrigger> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO proactive_triggers
        (id, tenant_id, name, status, trigger_type, conditions, message,
         playbook_id, delay_seconds, cooldown_hours, priority, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id, tenantId, data.name, data.status ?? "active", data.trigger_type,
        JSON.stringify(data.conditions ?? {}), data.message,
        data.playbook_id ?? null, data.delay_seconds ?? 30,
        data.cooldown_hours ?? 24, data.priority ?? 100, now, now,
      ]
    );
    const row = await getOne("SELECT * FROM proactive_triggers WHERE id = $1", [id]);
    return parseRow(row as Record<string, unknown>);
  },

  async update(id: string, data: Partial<Omit<ProactiveTrigger, "id" | "tenant_id">>): Promise<ProactiveTrigger | null> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (k === "conditions") {
        fields.push(`${k} = $${idx++}`);
        values.push(JSON.stringify(v));
      } else {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
    }
    fields.push(`updated_at = $${idx++}`);
    values.push(now);
    values.push(id);

    await run(`UPDATE proactive_triggers SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  },

  async delete(id: string): Promise<void> {
    await run("DELETE FROM proactive_triggers WHERE id = $1", [id]);
  },
};
