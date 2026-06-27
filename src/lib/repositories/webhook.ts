import { query, run, getOne } from "../db";
import { randomBytes } from "crypto";

export interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  status: "active" | "disabled";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_status: number | null;
  response_body: string | null;
  created_at: string;
}

export const webhookRepo = {
  async create(tenantId: string, data: {
    url: string;
    events?: string[];
    description?: string;
  }): Promise<Webhook> {
    const id = crypto.randomUUID();
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const events = data.events ?? ["conversation.created", "message.sent", "escalation.triggered", "conversation.closed"];
    const eventsJson = JSON.stringify(events);

    await run(
      `INSERT INTO webhooks (id, tenant_id, url, secret, events, status, description)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
      [id, tenantId, data.url, secret, eventsJson, data.description ?? null]
    );

    return { id, tenant_id: tenantId, url: data.url, secret, events, status: "active", description: data.description ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  },

  async findAll(tenantId: string): Promise<Webhook[]> {
    const res = await query(
      `SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows.map(parseWebhook);
  },

  async findById(id: string, tenantId: string): Promise<Webhook | null> {
    const row = await getOne(`SELECT * FROM webhooks WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return row ? parseWebhook(row) : null;
  },

  async update(id: string, tenantId: string, data: Partial<Pick<Webhook, "url" | "events" | "status" | "description">>): Promise<boolean> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (data.url !== undefined) { sets.push(`url = $${i++}`); vals.push(data.url); }
    if (data.events !== undefined) { sets.push(`events = $${i++}`); vals.push(JSON.stringify(data.events)); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`); vals.push(data.status); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); vals.push(data.description); }
    if (!sets.length) return false;
    sets.push(`updated_at = $${i++}`); vals.push(new Date().toISOString());
    vals.push(id); vals.push(tenantId);
    const r = await run(`UPDATE webhooks SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`, vals as string[]);
    return r.changes > 0;
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await run(`DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return r.changes > 0;
  },

  async createDelivery(data: {
    webhookId: string;
    tenantId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO webhook_deliveries (id, webhook_id, tenant_id, event_type, payload, status, attempts)
       VALUES ($1, $2, $3, $4, $5, 'pending', 0)`,
      [id, data.webhookId, data.tenantId, data.eventType, JSON.stringify(data.payload)]
    );
    return id;
  },

  async markDelivered(id: string, responseStatus: number, responseBody: string): Promise<void> {
    await run(
      `UPDATE webhook_deliveries SET status = 'delivered', attempts = attempts + 1, last_attempt_at = $1,
       response_status = $2, response_body = $3 WHERE id = $4`,
      [new Date().toISOString(), responseStatus, responseBody.slice(0, 1000), id]
    );
  },

  async markFailed(id: string, responseStatus: number | null, responseBody: string, nextRetry: string | null): Promise<void> {
    await run(
      `UPDATE webhook_deliveries SET status = $1, attempts = attempts + 1, last_attempt_at = $2,
       next_retry_at = $3, response_status = $4, response_body = $5 WHERE id = $6`,
      [nextRetry ? "pending" : "failed", new Date().toISOString(), nextRetry, responseStatus, responseBody.slice(0, 1000), id]
    );
  },

  async findDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    const res = await query(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [webhookId, limit]
    );
    return res.rows.map(parseDelivery);
  },

  async findActiveByTenant(tenantId: string): Promise<Webhook[]> {
    const res = await query(
      `SELECT * FROM webhooks WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );
    return res.rows.map(parseWebhook);
  },
};

function parseWebhook(row: Record<string, unknown>): Webhook {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    url: row.url as string,
    secret: row.secret as string,
    events: typeof row.events === "string" ? JSON.parse(row.events) : (row.events as string[]) ?? [],
    status: row.status as "active" | "disabled",
    description: (row.description as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: row.id as string,
    webhook_id: row.webhook_id as string,
    tenant_id: row.tenant_id as string,
    event_type: row.event_type as string,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload as Record<string, unknown>),
    status: row.status as "pending" | "delivered" | "failed",
    attempts: row.attempts as number,
    last_attempt_at: (row.last_attempt_at as string) ?? null,
    next_retry_at: (row.next_retry_at as string) ?? null,
    response_status: (row.response_status as number) ?? null,
    response_body: (row.response_body as string) ?? null,
    created_at: row.created_at as string,
  };
}
