import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";
import type { JourneyScenario, ScenarioExpectations, ScenarioRuntimeConfig, ScenarioTurn } from "@/lib/journey/scenario-runner";

export interface StoredJourneyScenario {
  id: string;
  tenant_id?: string;
  journey_id: string;
  name: string;
  description?: string;
  status?: "active" | "draft" | "archived";
  category?: "behavior" | "policy" | "tone" | "technical";
  turns: ScenarioTurn[];
  runtime?: ScenarioRuntimeConfig | null;
  expectations?: ScenarioExpectations | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["turns", "expectations", "tags"];
const RUNTIME_META_KEY = "__runtime";

interface EncodedScenarioFields {
  runtime?: ScenarioRuntimeConfig | null;
  expectations?: ScenarioExpectations | null;
}

function decodeRuntimeMetadata(
  expectations?: ScenarioExpectations | null
): EncodedScenarioFields {
  if (!expectations || typeof expectations !== "object") {
    return { runtime: undefined, expectations };
  }
  const raw = expectations as Record<string, unknown>;
  const runtime = raw[RUNTIME_META_KEY];
  const cleanedEntries = Object.entries(raw).filter(([key]) => key !== RUNTIME_META_KEY);
  const cleanedExpectations = cleanedEntries.length > 0
    ? (Object.fromEntries(cleanedEntries) as ScenarioExpectations)
    : undefined;
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
    return { runtime: undefined, expectations: cleanedExpectations };
  }
  return { runtime: runtime as ScenarioRuntimeConfig, expectations: cleanedExpectations };
}

function encodeRuntimeMetadata(
  expectations?: ScenarioExpectations | null,
  runtime?: ScenarioRuntimeConfig | null
): ScenarioExpectations | null {
  const base = expectations ? { ...(expectations as Record<string, unknown>) } : {};
  if (runtime) {
    base[RUNTIME_META_KEY] = runtime;
  }
  return Object.keys(base).length > 0 ? (base as ScenarioExpectations) : null;
}

class JourneyScenarioRepo extends Repository<StoredJourneyScenario> {
  constructor() {
    super("journey_scenarios", 300);
  }

  async findById(id: string): Promise<StoredJourneyScenario | null> {
    const row = await getOne("SELECT * FROM journey_scenarios WHERE id = $1", [id]);
    if (!row) return null;
    const parsed = this.parseJsonFields(row, JSON_FIELDS) as StoredJourneyScenario;
    const decoded = decodeRuntimeMetadata(parsed.expectations);
    return { ...parsed, runtime: decoded.runtime, expectations: decoded.expectations };
  }

  async findAll(tenantId?: string): Promise<StoredJourneyScenario[]> {
    const result = tenantId
      ? await query("SELECT * FROM journey_scenarios WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1000", [tenantId])
      : await query("SELECT * FROM journey_scenarios ORDER BY created_at DESC LIMIT 1000");
    return result.rows.map((r) => {
      const parsed = this.parseJsonFields(r, JSON_FIELDS) as StoredJourneyScenario;
      const decoded = decodeRuntimeMetadata(parsed.expectations);
      return { ...parsed, runtime: decoded.runtime, expectations: decoded.expectations };
    }) as StoredJourneyScenario[];
  }

  async findByJourney(journeyId: string, tenantId?: string): Promise<StoredJourneyScenario[]> {
    const result = tenantId
      ? await query("SELECT * FROM journey_scenarios WHERE journey_id = $1 AND tenant_id = $2 ORDER BY created_at DESC", [journeyId, tenantId])
      : await query("SELECT * FROM journey_scenarios WHERE journey_id = $1 ORDER BY created_at DESC", [journeyId]);
    return result.rows.map((r) => {
      const parsed = this.parseJsonFields(r, JSON_FIELDS) as StoredJourneyScenario;
      const decoded = decodeRuntimeMetadata(parsed.expectations);
      return { ...parsed, runtime: decoded.runtime, expectations: decoded.expectations };
    }) as StoredJourneyScenario[];
  }

  async create(data: Omit<StoredJourneyScenario, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<StoredJourneyScenario> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const encoded = {
      ...data,
      expectations: encodeRuntimeMetadata(data.expectations, data.runtime),
    };
    const str = this.stringifyJsonFields(encoded, JSON_FIELDS);

    await run(
      `INSERT INTO journey_scenarios (id, tenant_id, journey_id, name, description, status, category, turns, expectations, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        str.tenant_id ?? "r-mobile",
        str.journey_id,
        str.name,
        str.description ?? null,
        str.status ?? "active",
        str.category ?? "behavior",
        str.turns,
        str.expectations ?? null,
        str.tags ?? null,
        now,
        now,
      ]
    );

    await this.invalidate();
    return { ...data, id, created_at: now, updated_at: now } as StoredJourneyScenario;
  }

  async update(id: string, data: Partial<StoredJourneyScenario>): Promise<StoredJourneyScenario | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const runtime = data.runtime !== undefined ? data.runtime : existing.runtime;
    const expectations = data.expectations !== undefined ? data.expectations : existing.expectations;
    const encoded = {
      ...data,
      expectations: encodeRuntimeMetadata(expectations, runtime),
    };
    const str = this.stringifyJsonFields(encoded, JSON_FIELDS);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(str)) {
      if (v !== undefined && k !== "id" && k !== "created_at" && k !== "updated_at" && k !== "runtime") {
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

    await run(`UPDATE journey_scenarios SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM journey_scenarios WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }
}

export function toJourneyScenario(stored: StoredJourneyScenario): JourneyScenario {
  return {
    id: stored.id,
    name: stored.name,
    turns: stored.turns,
    runtime: stored.runtime ?? undefined,
    expect: stored.expectations ?? undefined,
  };
}

export const journeyScenarioRepo = new JourneyScenarioRepo();

