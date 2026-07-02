import { query, run, getOne } from "../db";
import { randomUUID } from "crypto";

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: "draft" | "scheduled" | "running" | "completed" | "paused" | "failed";
  channel: "sms" | "whatsapp" | "email";
  message_template?: string;
  use_ai_personalization: boolean;
  playbook_id?: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  reply_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  tenant_id: string;
  contact_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  variables: Record<string, string>;
  status: "pending" | "sent" | "delivered" | "failed";
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error?: string;
  conversation_id?: string;
  created_at: string;
}

function parseCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? undefined,
    status: row.status as Campaign["status"],
    channel: row.channel as Campaign["channel"],
    message_template: (row.message_template as string) ?? undefined,
    use_ai_personalization: !!(row.use_ai_personalization),
    playbook_id: (row.playbook_id as string) ?? undefined,
    scheduled_at: (row.scheduled_at as string) ?? undefined,
    started_at: (row.started_at as string) ?? undefined,
    completed_at: (row.completed_at as string) ?? undefined,
    total_contacts: (row.total_contacts as number) ?? 0,
    sent_count: (row.sent_count as number) ?? 0,
    delivered_count: (row.delivered_count as number) ?? 0,
    failed_count: (row.failed_count as number) ?? 0,
    reply_count: (row.reply_count as number) ?? 0,
    created_by: (row.created_by as string) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseCampaignContact(row: Record<string, unknown>): CampaignContact {
  return {
    id: row.id as string,
    campaign_id: row.campaign_id as string,
    tenant_id: row.tenant_id as string,
    contact_id: (row.contact_id as string) ?? undefined,
    name: (row.name as string) ?? undefined,
    phone: (row.phone as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    variables:
      typeof row.variables === "string"
        ? JSON.parse(row.variables)
        : (row.variables as Record<string, string>) ?? {},
    status: row.status as CampaignContact["status"],
    sent_at: (row.sent_at as string) ?? undefined,
    delivered_at: (row.delivered_at as string) ?? undefined,
    failed_at: (row.failed_at as string) ?? undefined,
    error: (row.error as string) ?? undefined,
    conversation_id: (row.conversation_id as string) ?? undefined,
    created_at: row.created_at as string,
  };
}

export const campaignRepo = {
  async create(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      channel: Campaign["channel"];
      message_template?: string;
      use_ai_personalization?: boolean;
      playbook_id?: string;
      scheduled_at?: string;
      created_by?: string;
    }
  ): Promise<Campaign> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const useAi = data.use_ai_personalization ? 1 : 0;

    await run(
      `INSERT INTO campaigns (id, tenant_id, name, description, status, channel, message_template,
        use_ai_personalization, playbook_id, scheduled_at, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        tenantId,
        data.name,
        data.description ?? null,
        data.scheduled_at ? "scheduled" : "draft",
        data.channel,
        data.message_template ?? null,
        useAi,
        data.playbook_id ?? null,
        data.scheduled_at ?? null,
        data.created_by ?? null,
        now,
        now,
      ]
    );

    return {
      id,
      tenant_id: tenantId,
      name: data.name,
      description: data.description,
      status: data.scheduled_at ? "scheduled" : "draft",
      channel: data.channel,
      message_template: data.message_template,
      use_ai_personalization: !!data.use_ai_personalization,
      playbook_id: data.playbook_id,
      scheduled_at: data.scheduled_at,
      total_contacts: 0,
      sent_count: 0,
      delivered_count: 0,
      failed_count: 0,
      reply_count: 0,
      created_by: data.created_by,
      created_at: now,
      updated_at: now,
    };
  },

  async findAll(tenantId: string): Promise<Campaign[]> {
    const res = await query(
      `SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows.map(parseCampaign);
  },

  async findById(id: string, tenantId: string): Promise<Campaign | null> {
    const row = await getOne(
      `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return row ? parseCampaign(row) : null;
  },

  async update(id: string, tenantId: string, data: Partial<Campaign>): Promise<boolean> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const fields: Array<keyof Campaign> = [
      "name", "description", "status", "channel", "message_template",
      "use_ai_personalization", "playbook_id", "scheduled_at", "started_at",
      "completed_at", "total_contacts", "sent_count", "delivered_count",
      "failed_count", "reply_count",
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        let val: unknown = data[field];
        if (field === "use_ai_personalization") val = val ? 1 : 0;
        sets.push(`${field} = $${i++}`);
        vals.push(val);
      }
    }

    if (!sets.length) return false;
    sets.push(`updated_at = $${i++}`);
    vals.push(new Date().toISOString());
    vals.push(id);
    vals.push(tenantId);

    const r = await run(
      `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      vals as string[]
    );
    return r.changes > 0;
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return r.changes > 0;
  },

  async addContacts(
    campaignId: string,
    tenantId: string,
    contacts: Array<{
      contact_id?: string;
      name?: string;
      phone?: string;
      email?: string;
      variables?: Record<string, string>;
    }>
  ): Promise<number> {
    const now = new Date().toISOString();
    let inserted = 0;

    for (const c of contacts) {
      const id = randomUUID();
      const variablesJson = JSON.stringify(c.variables ?? {});
      await run(
        `INSERT INTO campaign_contacts (id, campaign_id, tenant_id, contact_id, name, phone, email, variables, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)`,
        [id, campaignId, tenantId, c.contact_id ?? null, c.name ?? null, c.phone ?? null, c.email ?? null, variablesJson, now]
      );
      inserted++;
    }

    // Update total_contacts on the campaign
    await run(
      `UPDATE campaigns SET total_contacts = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1), updated_at = $2 WHERE id = $1`,
      [campaignId, new Date().toISOString()]
    );

    return inserted;
  },

  async getContacts(
    campaignId: string,
    tenantId: string,
    limit = 100,
    offset = 0
  ): Promise<CampaignContact[]> {
    const res = await query(
      `SELECT * FROM campaign_contacts WHERE campaign_id = $1 AND tenant_id = $2 ORDER BY created_at ASC LIMIT $3 OFFSET $4`,
      [campaignId, tenantId, limit, offset]
    );
    return res.rows.map(parseCampaignContact);
  },

  async updateContact(id: string, data: Partial<CampaignContact>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const fields: Array<keyof CampaignContact> = [
      "status", "sent_at", "delivered_at", "failed_at", "error", "conversation_id",
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${i++}`);
        vals.push(data[field] ?? null);
      }
    }

    if (!sets.length) return;
    vals.push(id);
    await run(
      `UPDATE campaign_contacts SET ${sets.join(", ")} WHERE id = $${i}`,
      vals as string[]
    );
  },

  async getPendingContacts(campaignId: string, limit = 100): Promise<CampaignContact[]> {
    const res = await query(
      `SELECT * FROM campaign_contacts WHERE campaign_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT $2`,
      [campaignId, limit]
    );
    return res.rows.map(parseCampaignContact);
  },

  async updateStats(
    campaignId: string,
    stats: Partial<Pick<Campaign, "sent_count" | "delivered_count" | "failed_count" | "reply_count">>
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (stats.sent_count !== undefined) { sets.push(`sent_count = sent_count + $${i++}`); vals.push(stats.sent_count); }
    if (stats.delivered_count !== undefined) { sets.push(`delivered_count = delivered_count + $${i++}`); vals.push(stats.delivered_count); }
    if (stats.failed_count !== undefined) { sets.push(`failed_count = failed_count + $${i++}`); vals.push(stats.failed_count); }
    if (stats.reply_count !== undefined) { sets.push(`reply_count = reply_count + $${i++}`); vals.push(stats.reply_count); }

    if (!sets.length) return;
    sets.push(`updated_at = $${i++}`);
    vals.push(new Date().toISOString());
    vals.push(campaignId);

    await run(
      `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${i}`,
      vals as string[]
    );
  },
};
