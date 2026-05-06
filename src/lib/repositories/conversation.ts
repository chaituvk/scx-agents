import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Conversation {
  id: string;
  tenant_id?: string;
  customer_name?: string;
  customer_email?: string;
  channel?: string;
  status?: "open" | "resolved" | "escalated";
  sentiment?: "positive" | "neutral" | "negative";
  agent_id?: string | null;
  assigned_to?: string | null;
  topic?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
}

class ConversationRepo extends Repository<Conversation> {
  constructor() {
    super("conversations", 120);
  }

  async findById(id: string): Promise<Conversation | null> {
    const cached = await this.cache.get<Conversation>(this.cacheKey(id));
    if (cached) return cached;

    const row = await getOne("SELECT * FROM conversations WHERE id = $1", [id]);
    if (!row) return null;

    await this.cache.set(this.cacheKey(id), row, this.cacheTtl);
    return row;
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Conversation | null> {
    const row = await getOne("SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
    return row as Conversation | null;
  }

  async findAll(limit: number = 100, tenantId?: string): Promise<Conversation[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}:limit:${limit}`) : this.listCacheKey(`limit:${limit}`);
    const cached = await this.cache.get<Conversation[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM conversations WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2", [tenantId, limit])
      : await query("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT $1", [limit]);
    await this.cache.set(cacheKey, result.rows, this.cacheTtl);
    return result.rows;
  }

  async findByStatus(status: string, limit: number = 50, tenantId?: string): Promise<Conversation[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}:status:${status}:limit:${limit}`) : this.listCacheKey(`status:${status}:limit:${limit}`);
    const cached = await this.cache.get<Conversation[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM conversations WHERE tenant_id = $1 AND status = $2 ORDER BY updated_at DESC LIMIT $3", [tenantId, status, limit])
      : await query("SELECT * FROM conversations WHERE status = $1 ORDER BY updated_at DESC LIMIT $2", [status, limit]);
    await this.cache.set(cacheKey, result.rows, this.cacheTtl);
    return result.rows;
  }

  async create(data: Omit<Conversation, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<Conversation> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO conversations (id, tenant_id, customer_name, customer_email, channel, status, sentiment, agent_id, assigned_to, topic, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, data.tenant_id ?? "r-mobile", data.customer_name ?? null, data.customer_email ?? null, data.channel ?? "web",
        data.status ?? "open", data.sentiment ?? "neutral", data.agent_id ?? null,
        data.assigned_to ?? null, data.topic ?? null, data.priority ?? "normal", now, now]
    );

    const conv = { ...data, id, created_at: now, updated_at: now } as Conversation;
    await this.invalidate();
    return conv;
  }

  async update(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && k !== "id" && k !== "created_at" && k !== "updated_at") {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    idx++;
    values.push(id);

    await run(`UPDATE conversations SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM conversations WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const conversationRepo = new ConversationRepo();
