import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface Journey {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  nodes: any[];
  edges?: any[];
  variables?: Record<string, any>;
  execution_mode?: "deterministic" | "llm" | "hybrid";
  status?: "draft" | "active" | "archived";
  version?: string;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["nodes", "edges", "variables"];

class JourneyRepo extends Repository<Journey> {
  constructor() {
    super("journeys", 300);
  }

  async findById(id: string): Promise<Journey | null> {
    const cached = await this.cache.get<Journey>(this.cacheKey(id));
    if (cached) return cached;

    const row = await getOne("SELECT * FROM journeys WHERE id = $1", [id]);
    if (!row) return null;

    const journey = this.parseJsonFields(row, JSON_FIELDS) as Journey;
    await this.cache.set(this.cacheKey(id), journey, this.cacheTtl);
    return journey;
  }

  async findAll(tenantId?: string): Promise<Journey[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}`) : this.listCacheKey();
    const cached = await this.cache.get<Journey[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM journeys WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId])
      : await query("SELECT * FROM journeys ORDER BY created_at DESC");
    const journeys = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as Journey[];
    await this.cache.set(cacheKey, journeys, this.cacheTtl);
    return journeys;
  }

  async findByTenant(tenant: string): Promise<Journey[]> {
    return this.findAll(tenant);
  }

  async create(data: Omit<Journey, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<Journey> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO journeys (id, tenant_id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, str.tenant_id ?? "r-mobile", str.name, str.description ?? null, str.nodes, str.edges ?? null, str.variables ?? null,
        str.execution_mode ?? "deterministic", str.status ?? "draft", str.version ?? "1.0.0", now, now]
    );

    const journey = { ...data, id, created_at: now, updated_at: now } as Journey;
    await this.invalidate();
    return journey;
  }

  async update(id: string, data: Partial<Journey>): Promise<Journey | null> {
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
    if (data.execution_mode !== undefined) {
      fields.push(`execution_mode = $${idx}`);
      values.push(data.execution_mode);
      idx++;
    }
    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    idx++;
    values.push(id);

    await run(`UPDATE journeys SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM journeys WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const journeyRepo = new JourneyRepo();
