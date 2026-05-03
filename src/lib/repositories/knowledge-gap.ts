import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface KnowledgeGap {
  id: string;
  tenant_id?: string;
  question: string;
  frequency?: number;
  status: string;
  suggested_answer?: string | null;
  source_ids?: string[] | null;
  created_at?: string;
}

const JSON_FIELDS = ["source_ids"];

class KnowledgeGapRepo extends Repository<KnowledgeGap> {
  constructor() {
    super("knowledge_gaps", 300);
  }

  async findById(id: string): Promise<KnowledgeGap | null> {
    const row = await getOne("SELECT * FROM knowledge_gaps WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as KnowledgeGap) : null;
  }

  async findAll(tenantId?: string): Promise<KnowledgeGap[]> {
    const result = tenantId
      ? await query("SELECT * FROM knowledge_gaps WHERE tenant_id = $1 ORDER BY frequency DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM knowledge_gaps ORDER BY frequency DESC LIMIT 200");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as KnowledgeGap[];
  }

  async create(data: Omit<KnowledgeGap, "id" | "created_at"> & { id?: string }): Promise<KnowledgeGap> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO knowledge_gaps (id, tenant_id, question, frequency, status, suggested_answer, source_ids, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, str.tenant_id ?? "r-mobile", str.question, str.frequency ?? 0, str.status ?? "open", str.suggested_answer ?? null, str.source_ids ?? null, now]
    );

    return { ...data, id, created_at: now } as KnowledgeGap;
  }

  async update(id: string, data: Partial<KnowledgeGap>): Promise<KnowledgeGap | null> {
    const str = this.stringifyJsonFields(data, JSON_FIELDS);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(str)) {
      if (v !== undefined && k !== "id" && k !== "created_at") {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE knowledge_gaps SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM knowledge_gaps WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const knowledgeGapRepo = new KnowledgeGapRepo();
