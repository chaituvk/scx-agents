import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface RegressionTest {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  last_run?: string | null;
  duration?: string | null;
  error_message?: string;
  created_at?: string;
}

class RegressionTestRepo extends Repository<RegressionTest> {
  constructor() {
    super("regression_tests", 300);
  }

  async findById(id: string): Promise<RegressionTest | null> {
    const row = await getOne("SELECT * FROM regression_tests WHERE id = $1", [id]);
    return row as RegressionTest | null;
  }

  async findAll(tenantId?: string): Promise<RegressionTest[]> {
    const result = tenantId
      ? await query("SELECT * FROM regression_tests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM regression_tests ORDER BY created_at DESC LIMIT 200");
    return result.rows as RegressionTest[];
  }

  async create(data: Omit<RegressionTest, "id" | "created_at"> & { id?: string }): Promise<RegressionTest> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO regression_tests (id, tenant_id, name, description, category, status, last_run, duration, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, data.tenant_id ?? "r-mobile", data.name, data.description ?? null, data.category, data.status ?? "pending", data.last_run ?? null, data.duration ?? null, data.error_message ?? null, now]
    );

    return { ...data, id, created_at: now } as RegressionTest;
  }

  async update(id: string, data: Partial<RegressionTest>): Promise<RegressionTest | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && k !== "id" && k !== "created_at") {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE regression_tests SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM regression_tests WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const regressionTestRepo = new RegressionTestRepo();
