import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Message {
  id: string;
  tenant_id?: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent_id?: string | null;
  intent?: string | null;
  groundings?: string[];
  confidence?: number | null;
  created_at?: string;
}

const JSON_FIELDS = ["groundings"];

class MessageRepo extends Repository<Message> {
  constructor() {
    super("messages", 120);
  }

  async findById(id: string): Promise<Message | null> {
    const row = await getOne("SELECT * FROM messages WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as Message) : null;
  }

  async findByConversation(conversationId: string): Promise<Message[]> {
    const cacheKey = this.listCacheKey(`conv:${conversationId}`);
    const cached = await this.cache.get<Message[]>(cacheKey);
    if (cached) return cached;

    const result = await query("SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC", [conversationId]);
    const messages = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Message[];
    await this.cache.set(cacheKey, messages, this.cacheTtl);
    return messages;
  }

  async findAll(tenantId?: string): Promise<Message[]> {
    const result = tenantId
      ? await query("SELECT * FROM messages WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 500", [tenantId])
      : await query("SELECT * FROM messages ORDER BY created_at DESC LIMIT 500");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Message[];
  }

  async create(data: Omit<Message, "id" | "created_at"> & { id?: string }): Promise<Message> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO messages (id, tenant_id, conversation_id, role, content, agent_id, intent, groundings, confidence, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, str.tenant_id ?? "r-mobile", str.conversation_id, str.role, str.content, str.agent_id ?? null, str.intent ?? null,
        str.groundings ?? null, str.confidence ?? null, now]
    );

    const msg = { ...data, id, created_at: now } as Message;
    await this.cache.del(this.listCacheKey(`conv:${data.conversation_id}`));
    return msg;
  }

  async update(id: string, data: Partial<Message>): Promise<Message | null> {
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

    await run(`UPDATE messages SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM messages WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const messageRepo = new MessageRepo();
