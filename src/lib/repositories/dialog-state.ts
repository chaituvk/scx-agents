import { query, getOne, run, isPostgres } from "@/lib/db";
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
  // Session state extension (Stage 2). Nullable for back-compat; populated by
  // orchestrator + sub-agents in Stage 3+.
  active_agent?: string | null;
  last_intent?: string | null;
  pending_action?: Record<string, any> | null;
  pending_approval?: Record<string, any> | null;
  topic_stack?: any[] | null;
  handoff_state?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["variables", "history", "context", "pending_action", "pending_approval", "topic_stack", "handoff_state"];

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

  async findByConversationForTenant(conversationId: string, tenantId: string): Promise<DialogState | null> {
    const row = await getOne("SELECT * FROM dialog_states WHERE conversation_id = $1 AND tenant_id = $2", [conversationId, tenantId]);
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
      `INSERT INTO dialog_states (id, tenant_id, conversation_id, journey_id, current_node_id, variables, history, context, done,
         active_agent, last_intent, pending_action, pending_approval, topic_stack, handoff_state,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, str.tenant_id ?? "r-mobile", str.conversation_id, str.journey_id ?? null, str.current_node_id ?? null,
        str.variables ?? null, str.history ?? null, str.context ?? null, str.done ?? 0,
        str.active_agent ?? null, str.last_intent ?? null,
        str.pending_action ?? null, str.pending_approval ?? null, str.topic_stack ?? null, str.handoff_state ?? null,
        now, now]
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

  async upsertByConversationForTenant(
    tenantId: string,
    conversationId: string,
    data: Partial<DialogState>,
  ): Promise<DialogState> {
    const existing = await this.findByConversationForTenant(conversationId, tenantId);
    if (existing) {
      await this.update(existing.id, data);
      return (await this.findByConversationForTenant(conversationId, tenantId))!;
    }
    return this.create({ tenant_id: tenantId, conversation_id: conversationId, ...data } as DialogState);
  }

  // Atomic write of dialog_states.context.ephemeral. Mode "set" overwrites the
  // ephemeral subkey; mode "merge" shallow-merges patch into the existing
  // value via PG's jsonb || or SQLite's json_patch (RFC 7396). Both modes
  // preserve sibling keys under context (e.g. lastMessage, auditTraceId).
  // Lossless across backends because the UPDATE runs as a single SQL
  // statement; no read-then-write race window after the row exists.
  async writeContextEphemeral(
    tenantId: string,
    conversationId: string,
    patch: Record<string, unknown>,
    mode: "set" | "merge",
  ): Promise<DialogState> {
    const existing = await this.findByConversationForTenant(conversationId, tenantId);
    if (!existing) {
      return this.create({
        tenant_id: tenantId,
        conversation_id: conversationId,
        context: { ephemeral: patch },
      });
    }

    const patchJson = JSON.stringify(patch);
    const now = new Date().toISOString();

    if (isPostgres()) {
      const newValueExpr = mode === "set"
        ? `$1::jsonb`
        : `coalesce(context->'ephemeral', '{}'::jsonb) || $1::jsonb`;
      await run(
        `UPDATE dialog_states
         SET context = jsonb_set(coalesce(context, '{}'::jsonb), '{ephemeral}', ${newValueExpr}, true),
             updated_at = $2
         WHERE id = $3`,
        [patchJson, now, existing.id],
      );
    } else {
      const newValueExpr = mode === "set"
        ? `json($1)`
        : `json_patch(coalesce(json_extract(context, '$.ephemeral'), '{}'), $1)`;
      await run(
        `UPDATE dialog_states
         SET context = json_set(coalesce(context, '{}'), '$.ephemeral', ${newValueExpr}),
             updated_at = $2
         WHERE id = $3`,
        [patchJson, now, existing.id],
      );
    }
    return (await this.findById(existing.id))!;
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM dialog_states WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const dialogStateRepo = new DialogStateRepo();
