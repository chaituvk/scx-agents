import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";

export interface SimulationRun {
  id: string;
  tenant_id?: string;
  scenario_name: string;
  outcome?: string | null;
  metrics?: Record<string, any> | null;
  issues?: string[] | null;
  messages?: any[] | null;
  created_at?: string;
}

const JSON_FIELDS = ["metrics", "issues", "messages"];

class SimulationRunRepo extends Repository<SimulationRun> {
  constructor() {
    super("simulation_runs", 300);
  }

  async findById(id: string): Promise<SimulationRun | null> {
    const row = await getOne("SELECT * FROM simulation_runs WHERE id = $1", [id]);
    return row ? (this.parseJsonFields(row, JSON_FIELDS) as SimulationRun) : null;
  }

  async findAll(tenantId?: string): Promise<SimulationRun[]> {
    const result = tenantId
      ? await query("SELECT * FROM simulation_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId])
      : await query("SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 200");
    return result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as SimulationRun[];
  }

  async create(data: Omit<SimulationRun, "id" | "created_at"> & { id?: string }): Promise<SimulationRun> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const str = this.stringifyJsonFields(data, JSON_FIELDS);

    await run(
      `INSERT INTO simulation_runs (id, tenant_id, scenario_name, outcome, metrics, issues, messages, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, str.tenant_id ?? "r-mobile", str.scenario_name, str.outcome ?? null, str.metrics ?? null, str.issues ?? null, str.messages ?? null, now]
    );

    return { ...data, id, created_at: now } as SimulationRun;
  }

  async update(id: string, data: Partial<SimulationRun>): Promise<SimulationRun | null> {
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

    values.push(id);
    await run(`UPDATE simulation_runs SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM simulation_runs WHERE id = $1", [id]);
    return (result.changes || 0) > 0;
  }
}

export const simulationRunRepo = new SimulationRunRepo();
