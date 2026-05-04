import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";
import type { RuntimePolicyRule, RuntimeProfileDefinition } from "@/lib/runtime/profiles";

export interface StoredRuntimeProfile extends RuntimeProfileDefinition {
  id: string;
  tenant_id?: string;
  policies?: RuntimePolicyRule[];
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["allowed_journeys", "allowed_tools", "allowed_slots", "guardrails", "policies", "config"];

class RuntimeProfileRepo extends Repository<StoredRuntimeProfile> {
  constructor() {
    super("runtime_profiles", 300);
  }

  async findById(id: string): Promise<StoredRuntimeProfile | null> {
    const row = await getOne("SELECT * FROM runtime_profiles WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as StoredRuntimeProfile) : null;
  }

  async findAll(tenantId?: string): Promise<StoredRuntimeProfile[]> {
    const result = tenantId
      ? await query("SELECT * FROM runtime_profiles WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 500", [tenantId])
      : await query("SELECT * FROM runtime_profiles ORDER BY created_at DESC LIMIT 500");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as StoredRuntimeProfile[];
  }

  async findActiveByTenant(tenantId: string): Promise<StoredRuntimeProfile[]> {
    const result = await query(
      "SELECT * FROM runtime_profiles WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 500",
      [tenantId, "active"]
    );
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as StoredRuntimeProfile[];
  }

  async create(data: Omit<StoredRuntimeProfile, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<StoredRuntimeProfile> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO runtime_profiles (id, tenant_id, name, kind, status, description, allowed_journeys, allowed_tools, allowed_slots, guardrails, policies, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        str.tenant_id ?? "r-mobile",
        str.name,
        str.kind ?? "specialist",
        str.status ?? "active",
        str.description ?? null,
        str.allowed_journeys ?? null,
        str.allowed_tools ?? null,
        str.allowed_slots ?? null,
        str.guardrails ?? null,
        str.policies ?? null,
        str.config ?? null,
        now,
        now,
      ]
    );

    await this.invalidate();
    return { ...data, id, created_at: now, updated_at: now } as StoredRuntimeProfile;
  }

  async update(id: string, data: Partial<StoredRuntimeProfile>): Promise<StoredRuntimeProfile | null> {
    const str = this.stringifyJsonFields(data, JSON_FIELDS);
    const fields: string[] = [];
    const values: unknown[] = [];
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

    await run(`UPDATE runtime_profiles SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM runtime_profiles WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export const runtimeProfileRepo = new RuntimeProfileRepo();

