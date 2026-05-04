import fs from "fs";
import path from "path";
import { run } from "./db";
import { compileJourney } from "./journey/schema";

const TENANT_IDS = ["r-mobile", "ichiba", "r-travel"];

interface FixtureJourney {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  execution_mode?: "deterministic" | "llm" | "hybrid";
  status?: "draft" | "active" | "archived";
  version?: string;
  nodes: unknown[];
  edges: unknown[];
  variables?: unknown;
}

interface FixtureRuntimeProfile {
  id: string;
  tenant_id: string;
  name: string;
  kind: string;
  status?: string;
  description?: string;
  allowed_journeys?: string[];
  allowed_tools?: string[];
  allowed_slots?: string[];
  guardrails?: string[];
  policies?: unknown[];
  config?: Record<string, unknown>;
}

interface FixtureScenario {
  id: string;
  tenant_id: string;
  journey_id: string;
  name: string;
  description?: string;
  status?: string;
  category?: string;
  turns: unknown[];
  runtime?: Record<string, unknown>;
  expectations?: Record<string, unknown>;
  tags?: string[];
}

const RUNTIME_META_KEY = "__runtime";

function readFixture<T>(tenantId: string, filename: string): T | null {
  const file = path.join(process.cwd(), "test-data", "tenants", tenantId, filename);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export async function seedMvpFixtures() {
  const now = new Date().toISOString();

  for (const tenantId of TENANT_IDS) {
    const journeyFixture = readFixture<{ journeys: FixtureJourney[] }>(tenantId, "journeys.json");
    for (const journey of journeyFixture?.journeys || []) {
      const compiled = compileJourney({
        ...journey,
        execution_mode: journey.execution_mode || "deterministic",
      });
      if (!compiled.valid) {
        console.log(`[seed-mvp] Skipping invalid journey ${journey.id}: ${compiled.errors.map((e) => e.message).join("; ")}`);
        continue;
      }

      await run(
        `INSERT INTO journeys (id, tenant_id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           nodes = EXCLUDED.nodes,
           edges = EXCLUDED.edges,
           variables = EXCLUDED.variables,
           execution_mode = EXCLUDED.execution_mode,
           status = EXCLUDED.status,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at`,
        [
          compiled.normalized.id || journey.id,
          tenantId,
          compiled.normalized.name,
          compiled.normalized.description,
          JSON.stringify(compiled.normalized.nodes),
          JSON.stringify(compiled.normalized.edges),
          JSON.stringify(compiled.normalized.variables),
          compiled.normalized.execution_mode,
          compiled.normalized.status,
          compiled.normalized.version,
          now,
          now,
        ]
      );
    }

    const profileFixture = readFixture<{ profiles: FixtureRuntimeProfile[] }>(tenantId, "runtime-profiles.json");
    for (const profile of profileFixture?.profiles || []) {
      await run(
        `INSERT INTO runtime_profiles (id, tenant_id, name, kind, status, description, allowed_journeys, allowed_tools, allowed_slots, guardrails, policies, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           kind = EXCLUDED.kind,
           status = EXCLUDED.status,
           description = EXCLUDED.description,
           allowed_journeys = EXCLUDED.allowed_journeys,
           allowed_tools = EXCLUDED.allowed_tools,
           allowed_slots = EXCLUDED.allowed_slots,
           guardrails = EXCLUDED.guardrails,
           policies = EXCLUDED.policies,
           config = EXCLUDED.config,
           updated_at = EXCLUDED.updated_at`,
        [
          profile.id,
          tenantId,
          profile.name,
          profile.kind,
          profile.status || "active",
          profile.description || "",
          JSON.stringify(profile.allowed_journeys || []),
          JSON.stringify(profile.allowed_tools || []),
          JSON.stringify(profile.allowed_slots || []),
          JSON.stringify(profile.guardrails || []),
          JSON.stringify(profile.policies || []),
          JSON.stringify(profile.config || {}),
          now,
          now,
        ]
      );
    }

    const scenarioFixture = readFixture<{ scenarios: FixtureScenario[] }>(tenantId, "journey-scenarios.json");
    for (const scenario of scenarioFixture?.scenarios || []) {
      const expectationsWithRuntime = {
        ...(scenario.expectations || {}),
        ...(scenario.runtime ? { [RUNTIME_META_KEY]: scenario.runtime } : {}),
      };
      await run(
        `INSERT INTO journey_scenarios (id, tenant_id, journey_id, name, description, status, category, turns, expectations, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           journey_id = EXCLUDED.journey_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           category = EXCLUDED.category,
           turns = EXCLUDED.turns,
           expectations = EXCLUDED.expectations,
           tags = EXCLUDED.tags,
           updated_at = EXCLUDED.updated_at`,
        [
          scenario.id,
          tenantId,
          scenario.journey_id,
          scenario.name,
          scenario.description || "",
          scenario.status || "active",
          scenario.category || "behavior",
          JSON.stringify(scenario.turns),
          JSON.stringify(expectationsWithRuntime),
          JSON.stringify(scenario.tags || []),
          now,
          now,
        ]
      );
    }
  }

  console.log("[seed-mvp] MVP fixtures seeded");
}

