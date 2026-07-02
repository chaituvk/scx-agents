import { query, run, getOne } from "../db";

export type RuleCondition = {
  field: "message" | "channel" | "customer_language" | "customer_tag" | "conversation_count" | "hour_of_day";
  operator: "contains" | "not_contains" | "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "not_in";
  value: string | string[] | number;
};

export interface RoutingRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  priority: number;
  status: "active" | "disabled";
  conditions: RuleCondition[];
  condition_logic: "any" | "all";
  action_type: string;
  action_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function parseRule(row: Record<string, unknown>): RoutingRule {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? undefined,
    priority: row.priority as number,
    status: row.status as "active" | "disabled",
    conditions: typeof row.conditions === "string" ? JSON.parse(row.conditions) : (row.conditions as RuleCondition[]) ?? [],
    condition_logic: row.condition_logic as "any" | "all",
    action_type: row.action_type as string,
    action_payload: typeof row.action_payload === "string" ? JSON.parse(row.action_payload) : (row.action_payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const routingRuleRepo = {
  async findActive(tenantId: string): Promise<RoutingRule[]> {
    const res = await query(
      `SELECT * FROM routing_rules WHERE tenant_id = $1 AND status = 'active' ORDER BY priority ASC`,
      [tenantId],
    );
    return res.rows.map(parseRule);
  },

  async findAll(tenantId: string): Promise<RoutingRule[]> {
    const res = await query(
      `SELECT * FROM routing_rules WHERE tenant_id = $1 ORDER BY priority ASC`,
      [tenantId],
    );
    return res.rows.map(parseRule);
  },

  async findById(id: string, tenantId: string): Promise<RoutingRule | null> {
    const row = await getOne(
      `SELECT * FROM routing_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return row ? parseRule(row) : null;
  },

  async create(
    tenantId: string,
    data: Omit<RoutingRule, "id" | "tenant_id" | "created_at" | "updated_at">,
  ): Promise<RoutingRule> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO routing_rules (id, tenant_id, name, description, priority, status, conditions, condition_logic, action_type, action_payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        tenantId,
        data.name,
        data.description ?? null,
        data.priority ?? 100,
        data.status ?? "active",
        JSON.stringify(data.conditions ?? []),
        data.condition_logic ?? "any",
        data.action_type,
        JSON.stringify(data.action_payload ?? {}),
        now,
        now,
      ],
    );
    return { id, tenant_id: tenantId, ...data, created_at: now, updated_at: now };
  },

  async update(id: string, tenantId: string, data: Partial<RoutingRule>): Promise<boolean> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (data.name !== undefined) { sets.push(`name = $${i++}`); vals.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); vals.push(data.description); }
    if (data.priority !== undefined) { sets.push(`priority = $${i++}`); vals.push(data.priority); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`); vals.push(data.status); }
    if (data.conditions !== undefined) { sets.push(`conditions = $${i++}`); vals.push(JSON.stringify(data.conditions)); }
    if (data.condition_logic !== undefined) { sets.push(`condition_logic = $${i++}`); vals.push(data.condition_logic); }
    if (data.action_type !== undefined) { sets.push(`action_type = $${i++}`); vals.push(data.action_type); }
    if (data.action_payload !== undefined) { sets.push(`action_payload = $${i++}`); vals.push(JSON.stringify(data.action_payload)); }
    if (!sets.length) return false;
    sets.push(`updated_at = $${i++}`); vals.push(new Date().toISOString());
    vals.push(id); vals.push(tenantId);
    const r = await run(
      `UPDATE routing_rules SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      vals as string[],
    );
    return r.changes > 0;
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `DELETE FROM routing_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.changes > 0;
  },
};
