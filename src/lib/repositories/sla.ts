import { query, run, getOne } from "../db";

export interface SlaConfig {
  id: string;
  tenant_id: string;
  name: string;
  priority: string;
  first_response_minutes: number;
  resolution_minutes: number;
  status: string;
  created_at: string;
}

export interface SlaBreachRow {
  id: string;
  tenant_id: string;
  conversation_id: string;
  sla_config_id: string | null;
  breach_type: string;
  breached_at: string;
  acknowledged_at: string | null;
  created_at: string;
}

function parseSlaConfig(row: Record<string, unknown>): SlaConfig {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    priority: row.priority as string,
    first_response_minutes: row.first_response_minutes as number,
    resolution_minutes: row.resolution_minutes as number,
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

function parseBreach(row: Record<string, unknown>): SlaBreachRow {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    conversation_id: row.conversation_id as string,
    sla_config_id: (row.sla_config_id as string) ?? null,
    breach_type: row.breach_type as string,
    breached_at: row.breached_at as string,
    acknowledged_at: (row.acknowledged_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

export const slaRepo = {
  async findConfigs(tenantId: string): Promise<SlaConfig[]> {
    const res = await query(
      `SELECT * FROM sla_configs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return res.rows.map(parseSlaConfig);
  },

  async findConfigById(id: string, tenantId: string): Promise<SlaConfig | null> {
    const row = await getOne(
      `SELECT * FROM sla_configs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return row ? parseSlaConfig(row) : null;
  },

  async createConfig(
    tenantId: string,
    data: Omit<SlaConfig, "id" | "tenant_id" | "created_at">,
  ): Promise<SlaConfig> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO sla_configs (id, tenant_id, name, priority, first_response_minutes, resolution_minutes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        tenantId,
        data.name,
        data.priority ?? "normal",
        data.first_response_minutes ?? 60,
        data.resolution_minutes ?? 480,
        data.status ?? "active",
        now,
      ],
    );
    return { id, tenant_id: tenantId, ...data, created_at: now };
  },

  async updateConfig(id: string, tenantId: string, data: Partial<SlaConfig>): Promise<boolean> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (data.name !== undefined) { sets.push(`name = $${i++}`); vals.push(data.name); }
    if (data.priority !== undefined) { sets.push(`priority = $${i++}`); vals.push(data.priority); }
    if (data.first_response_minutes !== undefined) { sets.push(`first_response_minutes = $${i++}`); vals.push(data.first_response_minutes); }
    if (data.resolution_minutes !== undefined) { sets.push(`resolution_minutes = $${i++}`); vals.push(data.resolution_minutes); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`); vals.push(data.status); }
    if (!sets.length) return false;
    vals.push(id); vals.push(tenantId);
    const r = await run(
      `UPDATE sla_configs SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      vals as string[],
    );
    return r.changes > 0;
  },

  async deleteConfig(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `DELETE FROM sla_configs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.changes > 0;
  },

  async recordBreach(data: {
    tenantId: string;
    conversationId: string;
    slaConfigId?: string;
    breachType: string;
    breachedAt: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO sla_breaches (id, tenant_id, conversation_id, sla_config_id, breach_type, breached_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.tenantId, data.conversationId, data.slaConfigId ?? null, data.breachType, data.breachedAt, now],
    );
    return id;
  },

  async listBreaches(tenantId: string, days = 7): Promise<SlaBreachRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const res = await query(
      `SELECT * FROM sla_breaches WHERE tenant_id = $1 AND created_at >= $2 ORDER BY breached_at DESC`,
      [tenantId, since],
    );
    return res.rows.map(parseBreach);
  },

  async acknowledgeBreach(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `UPDATE sla_breaches SET acknowledged_at = $1 WHERE id = $2 AND tenant_id = $3`,
      [new Date().toISOString(), id, tenantId],
    );
    return r.changes > 0;
  },

  async checkBreaches(tenantId: string): Promise<SlaBreachRow[]> {
    // Load all active SLA configs for this tenant
    const configs = await slaRepo.findConfigs(tenantId);
    const activeConfigs = configs.filter((c) => c.status === "active");

    if (activeConfigs.length === 0) return [];

    const now = new Date();
    const discovered: SlaBreachRow[] = [];

    for (const cfg of activeConfigs) {
      // First-response breach: open conversations with no assistant messages
      // where created_at + first_response_minutes < now
      const firstResponseCutoff = new Date(now.getTime() - cfg.first_response_minutes * 60 * 1000).toISOString();
      const frRes = await query(
        `SELECT c.id as conversation_id FROM conversations c
         WHERE c.tenant_id = $1
           AND c.status = 'open'
           AND c.created_at <= $2
           AND NOT EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id
               AND m.role = 'assistant'
           )
           AND NOT EXISTS (
             SELECT 1 FROM sla_breaches sb
             WHERE sb.conversation_id = c.id
               AND sb.tenant_id = $1
               AND sb.breach_type = 'first_response'
               AND sb.sla_config_id = $3
           )`,
        [tenantId, firstResponseCutoff, cfg.id],
      );

      for (const row of frRes.rows) {
        const breach: SlaBreachRow = {
          id: "",
          tenant_id: tenantId,
          conversation_id: row.conversation_id as string,
          sla_config_id: cfg.id,
          breach_type: "first_response",
          breached_at: now.toISOString(),
          acknowledged_at: null,
          created_at: now.toISOString(),
        };
        discovered.push(breach);
      }

      // Resolution breach: open conversations where created_at + resolution_minutes < now
      const resolutionCutoff = new Date(now.getTime() - cfg.resolution_minutes * 60 * 1000).toISOString();
      const rRes = await query(
        `SELECT c.id as conversation_id FROM conversations c
         WHERE c.tenant_id = $1
           AND c.status = 'open'
           AND c.created_at <= $2
           AND NOT EXISTS (
             SELECT 1 FROM sla_breaches sb
             WHERE sb.conversation_id = c.id
               AND sb.tenant_id = $1
               AND sb.breach_type = 'resolution'
               AND sb.sla_config_id = $3
           )`,
        [tenantId, resolutionCutoff, cfg.id],
      );

      for (const row of rRes.rows) {
        const breach: SlaBreachRow = {
          id: "",
          tenant_id: tenantId,
          conversation_id: row.conversation_id as string,
          sla_config_id: cfg.id,
          breach_type: "resolution",
          breached_at: now.toISOString(),
          acknowledged_at: null,
          created_at: now.toISOString(),
        };
        discovered.push(breach);
      }
    }

    return discovered;
  },

  async openConversationsAtRisk(tenantId: string): Promise<Array<{ conversation_id: string; breach_type: string; minutes_remaining: number; sla_config_id: string }>> {
    const configs = await slaRepo.findConfigs(tenantId);
    const activeConfigs = configs.filter((c) => c.status === "active");
    if (!activeConfigs.length) return [];

    const now = new Date();
    const atRisk: Array<{ conversation_id: string; breach_type: string; minutes_remaining: number; sla_config_id: string }> = [];

    for (const cfg of activeConfigs) {
      // At-risk: will breach first_response within the next 30 minutes
      const warningCutoff = new Date(now.getTime() - (cfg.first_response_minutes - 30) * 60 * 1000).toISOString();
      const safeCutoff = new Date(now.getTime() - cfg.first_response_minutes * 60 * 1000).toISOString();

      const frRes = await query(
        `SELECT c.id as conversation_id, c.created_at FROM conversations c
         WHERE c.tenant_id = $1
           AND c.status = 'open'
           AND c.created_at <= $2
           AND c.created_at > $3
           AND NOT EXISTS (
             SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.role = 'assistant'
           )`,
        [tenantId, warningCutoff, safeCutoff],
      );

      for (const row of frRes.rows) {
        const createdAt = new Date(row.created_at as string);
        const deadline = new Date(createdAt.getTime() + cfg.first_response_minutes * 60 * 1000);
        const minutesRemaining = Math.round((deadline.getTime() - now.getTime()) / 60000);
        atRisk.push({ conversation_id: row.conversation_id as string, breach_type: "first_response", minutes_remaining: minutesRemaining, sla_config_id: cfg.id });
      }
    }

    return atRisk;
  },
};
