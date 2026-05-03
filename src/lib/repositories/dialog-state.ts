import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface DialogState {
  id: string;
  tenant_id?: string;
  conversation_id: string;
  journey_id?: string | null;
  current_node_id?: string | null;
  variables?: Record<string, any>;
  history?: any[];
  context?: Record<string, any>;
  done?: number;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["variables", "history", "context"];

class DialogStateRepo extends Repository<DialogState> {
  constructor() {
    super("dialog_states", 120);
  }

  async findById(id: string): Promise<DialogState | null> {
    const row = await getOne("SELECT * FROM dialog_states WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as DialogState) : null;
  }

  async findByConversation(conversationId: string): Promise<DialogState | null> {
    const row = await getOne("SELECT * FROM dialog_states WHERE conversation_id = $1", [conversationId]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as DialogState) : null;
  }

  async findAll(tenantId?: string): Promise<DialogState[]> {
    const result = tenantId
      ? await query("SELECT * FROM dialog_states WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM dialog_states ORDER BY updated_at DESC LIMIT 200");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as DialogState[];
  }

  async create(data: Omit<DialogState, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<DialogState> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO dialog_states (id, tenant_id, conversation_id, journey_id, current_node_id, variables, history, context, done, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, str.tenant_id ?? "r-mobile", str.conversation_id, str.journey_id ?? null, str.current_node_id ?? null,
        str.variables ?? null, str.history ?? null, str.context ?? null, str.done ?? 0, now, now]
    );

    return { ...data, id, created_at: now, updated_at: now } as DialogState;
  }

  async update(id: string, data: Partial<DialogState>): Promise<DialogState | null> {
    const str = this.stringifyJsonFields(data, JSON_FIELDS);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(str)) {
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

    await run(`UPDATE dialog_states SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async upsertByConversation(conversationId: string, data: Partial<DialogState>): Promise<DialogState> {
    const existing = await this.findByConversation(conversationId);
    if (existing) {
      await this.update(existing.id, data);
      return (await this.findByConversation(conversationId))!;
    }
    return this.create({ conversation_id: conversationId, ...data } as DialogState);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM dialog_states WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const dialogStateRepo = new DialogStateRepo();
