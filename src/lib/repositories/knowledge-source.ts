import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface KnowledgeSource {
  id: string;
  tenant_id?: string;
  name: string;
  type: string;
  status: string;
  entries?: number;
  url?: string | null;
  last_sync?: string | null;
  gaps?: string[] | null;
  config?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["gaps", "config"];

class KnowledgeSourceRepo extends Repository<KnowledgeSource> {
  constructor() {
    super("knowledge_sources", 300);
  }

  async findById(id: string): Promise<KnowledgeSource | null> {
    const row = await getOne("SELECT * FROM knowledge_sources WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as KnowledgeSource) : null;
  }

  async findAll(tenantId?: string): Promise<KnowledgeSource[]> {
    const result = tenantId
      ? await query("SELECT * FROM knowledge_sources WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM knowledge_sources ORDER BY created_at DESC LIMIT 200");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as KnowledgeSource[];
  }

  async create(data: Omit<KnowledgeSource, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<KnowledgeSource> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO knowledge_sources (id, tenant_id, name, type, status, entries, url, last_sync, gaps, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, str.tenant_id ?? "r-mobile", str.name, str.type, str.status ?? "draft", str.entries ?? 0, str.url ?? null, str.last_sync ?? null, str.gaps ?? null, str.config ?? null, now, now]
    );

    return { ...data, id, created_at: now, updated_at: now } as KnowledgeSource;
  }

  async update(id: string, data: Partial<KnowledgeSource>): Promise<KnowledgeSource | null> {
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

    await run(`UPDATE knowledge_sources SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM knowledge_sources WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const knowledgeSourceRepo = new KnowledgeSourceRepo();
