import { query, run, getOne } from "../db";
import { randomUUID } from "crypto";

export interface CustomerProfile {
  id: string;
  tenant_id: string;
  external_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  channel?: string;
  language: string;
  timezone?: string;
  tags: string[];
  custom_attributes: Record<string, string>;
  total_conversations: number;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerMemory {
  id: string;
  tenant_id: string;
  customer_id: string;
  conversation_id?: string;
  memory_type: "preference" | "complaint" | "fact" | "goal" | "purchase" | "interaction";
  content: string;
  importance: number;
  expires_at?: string;
  created_at: string;
}

function parseProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    external_id: (row.external_id as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    phone: (row.phone as string) ?? undefined,
    name: (row.name as string) ?? undefined,
    channel: (row.channel as string) ?? undefined,
    language: (row.language as string) ?? "en",
    timezone: (row.timezone as string) ?? undefined,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : ((row.tags as string[]) ?? []),
    custom_attributes:
      typeof row.custom_attributes === "string"
        ? JSON.parse(row.custom_attributes)
        : ((row.custom_attributes as Record<string, string>) ?? {}),
    total_conversations: (row.total_conversations as number) ?? 0,
    last_seen_at: (row.last_seen_at as string) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function parseMemory(row: Record<string, unknown>): CustomerMemory {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    customer_id: row.customer_id as string,
    conversation_id: (row.conversation_id as string) ?? undefined,
    memory_type: row.memory_type as CustomerMemory["memory_type"],
    content: row.content as string,
    importance: (row.importance as number) ?? 5,
    expires_at: (row.expires_at as string) ?? undefined,
    created_at: row.created_at as string,
  };
}

export const customerProfileRepo = {
  async upsertByContact(
    tenantId: string,
    data: {
      email?: string;
      phone?: string;
      name?: string;
      channel?: string;
      external_id?: string;
    },
  ): Promise<CustomerProfile> {
    const now = new Date().toISOString();

    // Try email match first
    if (data.email) {
      const existing = await getOne(
        `SELECT * FROM customer_profiles WHERE tenant_id = $1 AND email = $2`,
        [tenantId, data.email],
      );
      if (existing) {
        const sets: string[] = [`last_seen_at = $1`, `updated_at = $2`];
        const vals: unknown[] = [now, now];
        let i = 3;
        if (data.name) { sets.push(`name = $${i++}`); vals.push(data.name); }
        if (data.phone) { sets.push(`phone = $${i++}`); vals.push(data.phone); }
        if (data.channel) { sets.push(`channel = $${i++}`); vals.push(data.channel); }
        vals.push(existing.id as string, tenantId);
        await run(
          `UPDATE customer_profiles SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
          vals as string[],
        );
        const updated = await getOne(
          `SELECT * FROM customer_profiles WHERE id = $1`,
          [existing.id as string],
        );
        return parseProfile(updated);
      }
    }

    // Try phone match
    if (data.phone) {
      const existing = await getOne(
        `SELECT * FROM customer_profiles WHERE tenant_id = $1 AND phone = $2`,
        [tenantId, data.phone],
      );
      if (existing) {
        const sets: string[] = [`last_seen_at = $1`, `updated_at = $2`];
        const vals: unknown[] = [now, now];
        let i = 3;
        if (data.name) { sets.push(`name = $${i++}`); vals.push(data.name); }
        if (data.email) { sets.push(`email = $${i++}`); vals.push(data.email); }
        if (data.channel) { sets.push(`channel = $${i++}`); vals.push(data.channel); }
        vals.push(existing.id as string, tenantId);
        await run(
          `UPDATE customer_profiles SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
          vals as string[],
        );
        const updated = await getOne(
          `SELECT * FROM customer_profiles WHERE id = $1`,
          [existing.id as string],
        );
        return parseProfile(updated);
      }
    }

    // Create new profile
    const id = randomUUID();
    await run(
      `INSERT INTO customer_profiles
         (id, tenant_id, external_id, email, phone, name, channel, language, tags, custom_attributes, total_conversations, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'en', '[]', '{}', 0, $8, $9, $10)`,
      [
        id,
        tenantId,
        data.external_id ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.name ?? null,
        data.channel ?? null,
        now,
        now,
        now,
      ],
    );
    const created = await getOne(`SELECT * FROM customer_profiles WHERE id = $1`, [id]);
    return parseProfile(created);
  },

  async findById(id: string, tenantId: string): Promise<CustomerProfile | null> {
    const row = await getOne(
      `SELECT * FROM customer_profiles WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return row ? parseProfile(row) : null;
  },

  async findByEmail(email: string, tenantId: string): Promise<CustomerProfile | null> {
    const row = await getOne(
      `SELECT * FROM customer_profiles WHERE email = $1 AND tenant_id = $2`,
      [email, tenantId],
    );
    return row ? parseProfile(row) : null;
  },

  async findByPhone(phone: string, tenantId: string): Promise<CustomerProfile | null> {
    const row = await getOne(
      `SELECT * FROM customer_profiles WHERE phone = $1 AND tenant_id = $2`,
      [phone, tenantId],
    );
    return row ? parseProfile(row) : null;
  },

  async update(
    id: string,
    tenantId: string,
    data: Partial<CustomerProfile>,
  ): Promise<boolean> {
    const allowed: Array<keyof CustomerProfile> = [
      "external_id", "email", "phone", "name", "channel", "language",
      "timezone", "tags", "custom_attributes",
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (key in data) {
        const val = data[key];
        if (key === "tags" || key === "custom_attributes") {
          sets.push(`${key} = $${i++}`);
          vals.push(JSON.stringify(val));
        } else {
          sets.push(`${key} = $${i++}`);
          vals.push(val);
        }
      }
    }
    if (!sets.length) return false;
    sets.push(`updated_at = $${i++}`);
    vals.push(new Date().toISOString());
    vals.push(id, tenantId);
    const r = await run(
      `UPDATE customer_profiles SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      vals as string[],
    );
    return r.changes > 0;
  },

  async incrementConversationCount(id: string): Promise<void> {
    await run(
      `UPDATE customer_profiles SET total_conversations = total_conversations + 1, updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id],
    );
  },

  async search(
    tenantId: string,
    searchQuery: string,
    limit = 20,
  ): Promise<CustomerProfile[]> {
    const like = `%${searchQuery}%`;
    const res = await query(
      `SELECT * FROM customer_profiles
       WHERE tenant_id = $1
         AND (name ILIKE $2 OR email ILIKE $3 OR phone ILIKE $4)
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT $5`,
      [tenantId, like, like, like, limit],
    );
    // SQLite doesn't support ILIKE — fall back with LIKE if no results from PG path
    if (res.rows.length === 0 && searchQuery) {
      const fallback = await query(
        `SELECT * FROM customer_profiles
         WHERE tenant_id = $1
           AND (name LIKE $2 OR email LIKE $3 OR phone LIKE $4)
         ORDER BY last_seen_at DESC
         LIMIT $5`,
        [tenantId, like, like, like, limit],
      );
      return fallback.rows.map(parseProfile);
    }
    return res.rows.map(parseProfile);
  },

  // ── Memories ───────────────────────────────────────────────────────

  async addMemory(data: {
    tenantId: string;
    customerId: string;
    conversationId?: string;
    memory_type: CustomerMemory["memory_type"];
    content: string;
    importance?: number;
    expires_at?: string;
  }): Promise<CustomerMemory> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const importance = data.importance ?? 5;
    await run(
      `INSERT INTO customer_memories
         (id, tenant_id, customer_id, conversation_id, memory_type, content, importance, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.tenantId,
        data.customerId,
        data.conversationId ?? null,
        data.memory_type,
        data.content,
        importance,
        data.expires_at ?? null,
        now,
      ],
    );
    return {
      id,
      tenant_id: data.tenantId,
      customer_id: data.customerId,
      conversation_id: data.conversationId,
      memory_type: data.memory_type,
      content: data.content,
      importance,
      expires_at: data.expires_at,
      created_at: now,
    };
  },

  async getMemories(
    customerId: string,
    tenantId: string,
    limit = 20,
  ): Promise<CustomerMemory[]> {
    const res = await query(
      `SELECT * FROM customer_memories
       WHERE customer_id = $1 AND tenant_id = $2
         AND (expires_at IS NULL OR expires_at > $3)
       ORDER BY importance DESC, created_at DESC
       LIMIT $4`,
      [customerId, tenantId, new Date().toISOString(), limit],
    );
    return res.rows.map(parseMemory);
  },

  async deleteExpiredMemories(): Promise<number> {
    const r = await run(
      `DELETE FROM customer_memories WHERE expires_at IS NOT NULL AND expires_at <= $1`,
      [new Date().toISOString()],
    );
    return r.changes;
  },
};
