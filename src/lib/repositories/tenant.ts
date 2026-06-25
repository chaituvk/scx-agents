import { getOne, query, run } from "@/lib/db";
import { Repository } from "./base";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  primary_color?: string;
  accent_color?: string;
  welcome_message?: string;
  tone?: string;
  off_limit_topics?: string[] | null;
  off_limit_phrases?: string[] | null;
  approval_threshold?: number;
  require_approval?: number;
  config?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["off_limit_topics", "off_limit_phrases", "config"];

class TenantRepo extends Repository<Tenant> {
  constructor() {
    super("tenants", 600);
  }

  async findById(id: string): Promise<Tenant | null> {
    const cached = await this.cache.get<Tenant>(this.cacheKey(id));
    if (cached) return cached;
    const row = await getOne("SELECT * FROM tenants WHERE id = $1", [id]);
    if (!row) return null;
    const parsed = this.parseJsonFields(row, JSON_FIELDS) as Tenant;
    await this.cache.set(this.cacheKey(id), parsed, this.cacheTtl);
    return parsed;
  }

  async findAll(): Promise<Tenant[]> {
    const cacheKey = this.listCacheKey();
    const cached = await this.cache.get<Tenant[]>(cacheKey);
    if (cached) return cached;

    const result = await query("SELECT * FROM tenants ORDER BY created_at ASC");
    const tenants = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Tenant[];
    await this.cache.set(cacheKey, tenants, this.cacheTtl);
    return tenants;
  }

  async create(data: Omit<Tenant, "id" | "created_at">): Promise<Tenant> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO tenants (id, name, slug, primary_color, accent_color, welcome_message, tone,
       off_limit_topics, off_limit_phrases, approval_threshold, require_approval, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        str.name,
        str.slug,
        str.primary_color ?? "#c4a574",
        str.accent_color ?? "#0a0a0a",
        str.welcome_message ?? null,
        str.tone ?? "empathetic",
        str.off_limit_topics ?? null,
        str.off_limit_phrases ?? null,
        str.approval_threshold ?? 500,
        str.require_approval ?? 1,
        str.config ?? null,
        now,
        now,
      ]
    );

    await this.invalidate();
    return { ...data, id, created_at: now } as Tenant;
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant | null> {
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

    await run(`UPDATE tenants SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM tenants WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const tenantRepo = new TenantRepo();
