import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Agent {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  status: "draft" | "staging" | "production";
  goals?: string[];
  skills?: string[];
  guardrails?: string[];
  languages?: string[];
  channels?: string[];
  tone?: string;
  welcome_message?: string;
  primary_color?: string;
  accent_color?: string;
  off_limit_topics?: string[];
  off_limit_phrases?: string[];
  approval_threshold?: number;
  require_approval?: number;
  created_at?: string;
  updated_at?: string;
  version?: string;
}

const JSON_FIELDS = ["goals", "skills", "guardrails", "languages", "channels", "off_limit_topics", "off_limit_phrases"];

class AgentRepo extends Repository<Agent> {
  constructor() {
    super("agents", 300);
  }

  async findById(id: string): Promise<Agent | null> {
    const cached = await this.cache.get<Agent>(this.cacheKey(id));
    if (cached) return cached;

    const row = await getOne("SELECT * FROM agents WHERE id = $1", [id]);
    if (!row) return null;

    const agent = this.parseJsonFields(row, JSON_FIELDS) as Agent;
    await this.cache.set(this.cacheKey(id), agent, this.cacheTtl);
    return agent;
  }

  async findAll(tenantId?: string): Promise<Agent[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}`) : this.listCacheKey();
    const cached = await this.cache.get<Agent[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM agents WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId])
      : await query("SELECT * FROM agents ORDER BY created_at DESC");
    const agents = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Agent[];
    await this.cache.set(cacheKey, agents, this.cacheTtl);
    return agents;
  }

  async findByStatus(status: string, tenantId?: string): Promise<Agent[]> {
    const cacheKey = tenantId ? this.listCacheKey(`status:${status}:tenant:${tenantId}`) : this.listCacheKey(`status:${status}`);
    const cached = await this.cache.get<Agent[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM agents WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC", [tenantId, status])
      : await query("SELECT * FROM agents WHERE status = $1 ORDER BY created_at DESC", [status]);
    const agents = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Agent[];
    await this.cache.set(cacheKey, agents, this.cacheTtl);
    return agents;
  }

  async create(data: Omit<Agent, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<Agent> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO agents (id, tenant_id, name, description, status, goals, skills, guardrails, languages, channels,
       tone, welcome_message, primary_color, accent_color, off_limit_topics, off_limit_phrases,
       approval_threshold, require_approval, created_at, updated_at, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        id, str.tenant_id ?? "r-mobile", str.name, str.description ?? null, str.status ?? "draft",
        str.goals ?? null, str.skills ?? null, str.guardrails ?? null,
        str.languages ?? null, str.channels ?? null,
        str.tone ?? "empathetic", str.welcome_message ?? null,
        str.primary_color ?? "#c4a574", str.accent_color ?? "#0a0a0a",
        str.off_limit_topics ?? null, str.off_limit_phrases ?? null,
        str.approval_threshold ?? 500, str.require_approval ?? 1,
        now, now, str.version ?? "1.0.0"
      ]
    );

    const agent = { ...data, id, created_at: now, updated_at: now } as Agent;
    await this.invalidate();
    return agent;
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent | null> {
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

    await run(`UPDATE agents SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM agents WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const agentRepo = new AgentRepo();
