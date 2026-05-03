import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Integration {
  id: string;
  tenant_id?: string;
  name: string;
  type: string;
  config?: Record<string, any>;
  status?: string;
  records?: string;
  last_sync?: string;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["config"];

class IntegrationRepo extends Repository<Integration> {
  constructor() {
    super("integrations", 300);
  }

  async findById(id: string): Promise<Integration | null> {
    const row = await getOne("SELECT * FROM integrations WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as Integration) : null;
  }

  async findAll(tenantId?: string): Promise<Integration[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}`) : this.listCacheKey();
    const cached = await this.cache.get<Integration[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM integrations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM integrations ORDER BY created_at DESC LIMIT 200");
    const integrations = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Integration[];
    await this.cache.set(cacheKey, integrations, this.cacheTtl);
    return integrations;
  }

  async create(data: Omit<Integration, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<Integration> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO integrations (id, tenant_id, name, type, config, status, records, last_sync, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, str.tenant_id ?? "r-mobile", str.name, str.type, str.config ?? null, str.status ?? "active", str.records ?? null, str.last_sync ?? null, now, now]
    );

    return { ...data, id, created_at: now, updated_at: now } as Integration;
  }

  async update(id: string, data: Partial<Integration>): Promise<Integration | null> {
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

    await run(`UPDATE integrations SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM integrations WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const integrationRepo = new IntegrationRepo();
