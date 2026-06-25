import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Playbook {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  persona: string;
  topics: string[];
  instructions: string[];
  policies: object[];
  actions: string[];
  escalation_triggers: string[];
  end_message?: string;
  model_tier?: string;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["topics", "instructions", "policies", "actions", "escalation_triggers"];

class PlaybookRepo extends Repository<Playbook> {
  constructor() {
    super("playbooks", 300);
  }

  async findById(id: string): Promise<Playbook | null> {
    const cached = await this.cache.get<Playbook>(this.cacheKey(id));
    if (cached) return cached;

    const row = await getOne("SELECT * FROM playbooks WHERE id = $1", [id]);
    if (!row) return null;

    const playbook = this.parseJsonFields(row, JSON_FIELDS) as Playbook;
    await this.cache.set(this.cacheKey(id), playbook, this.cacheTtl);
    return playbook;
  }

  async findAll(tenantId: string): Promise<Playbook[]> {
    const cacheKey = this.listCacheKey(`tenant:${tenantId}`);
    const cached = await this.cache.get<Playbook[]>(cacheKey);
    if (cached) return cached;

    const result = await query(
      "SELECT * FROM playbooks WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    const playbooks = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Playbook[];
    await this.cache.set(cacheKey, playbooks, this.cacheTtl);
    return playbooks;
  }

  async findActive(tenantId: string): Promise<Playbook[]> {
    const cacheKey = this.listCacheKey(`active:tenant:${tenantId}`);
    const cached = await this.cache.get<Playbook[]>(cacheKey);
    if (cached) return cached;

    const result = await query(
      "SELECT * FROM playbooks WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC",
      [tenantId]
    );
    const playbooks = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Playbook[];
    await this.cache.set(cacheKey, playbooks, this.cacheTtl);
    return playbooks;
  }

  async create(data: Omit<Playbook, "id" | "created_at" | "updated_at">): Promise<Playbook> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO playbooks (id, tenant_id, name, description, status, persona, topics, instructions,
       policies, actions, escalation_triggers, end_message, model_tier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        str.tenant_id,
        str.name,
        str.description ?? "",
        str.status ?? "draft",
        str.persona ?? "",
        str.topics ?? "[]",
        str.instructions ?? "[]",
        str.policies ?? "[]",
        str.actions ?? "[]",
        str.escalation_triggers ?? "[]",
        str.end_message ?? null,
        str.model_tier ?? "reasoning",
        now,
        now,
      ]
    );

    const playbook = { ...data, id, created_at: now, updated_at: now } as Playbook;
    await this.invalidate();
    return playbook;
  }

  async update(id: string, data: Partial<Playbook>): Promise<Playbook | null> {
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

    await run(`UPDATE playbooks SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM playbooks WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const playbookRepo = new PlaybookRepo();
