import { query, getOne, run } from "@/lib/db";
import { randomUUID } from "crypto";

const JSON_FIELDS = ["topics", "instructions", "policies", "actions", "escalation_triggers"];

export interface PlaybookVersion {
  id: string;
  tenant_id: string;
  playbook_id: string;
  version: number;
  name: string;
  description: string;
  persona: string;
  topics: string[];
  instructions: string[];
  policies: object[];
  actions: string[];
  escalation_triggers: string[];
  end_message?: string;
  model_tier?: string;
  change_summary?: string;
  created_by?: string;
  created_at?: string;
}

function parseRow(row: Record<string, unknown>): PlaybookVersion {
  for (const f of JSON_FIELDS) {
    if (typeof row[f] === "string") {
      try { row[f] = JSON.parse(row[f] as string); } catch { /* keep as-is */ }
    }
  }
  return row as unknown as PlaybookVersion;
}

export const playbookVersionRepo = {
  async listByPlaybook(playbookId: string): Promise<PlaybookVersion[]> {
    const result = await query(
      "SELECT * FROM playbook_versions WHERE playbook_id = $1 ORDER BY version DESC",
      [playbookId]
    );
    return result.rows.map(parseRow);
  },

  async findByVersion(playbookId: string, version: number): Promise<PlaybookVersion | null> {
    const row = await getOne(
      "SELECT * FROM playbook_versions WHERE playbook_id = $1 AND version = $2",
      [playbookId, version]
    );
    return row ? parseRow(row as Record<string, unknown>) : null;
  },

  async getLatestVersion(playbookId: string): Promise<number> {
    const row = await getOne(
      "SELECT COALESCE(MAX(version), 0) as max_version FROM playbook_versions WHERE playbook_id = $1",
      [playbookId]
    );
    return Number((row as Record<string, unknown>)?.max_version ?? 0);
  },

  async snapshot(
    tenantId: string,
    playbookId: string,
    playbook: {
      name: string;
      description?: string;
      persona?: string;
      topics?: unknown[];
      instructions?: unknown[];
      policies?: unknown[];
      actions?: unknown[];
      escalation_triggers?: unknown[];
      end_message?: string;
      model_tier?: string;
    },
    opts: { changeSummary?: string; createdBy?: string } = {}
  ): Promise<PlaybookVersion> {
    const nextVersion = (await this.getLatestVersion(playbookId)) + 1;
    const id = randomUUID();
    const now = new Date().toISOString();

    const topics = JSON.stringify(playbook.topics ?? []);
    const instructions = JSON.stringify(playbook.instructions ?? []);
    const policies = JSON.stringify(playbook.policies ?? []);
    const actions = JSON.stringify(playbook.actions ?? []);
    const escalation_triggers = JSON.stringify(playbook.escalation_triggers ?? []);

    await run(
      `INSERT INTO playbook_versions
        (id, tenant_id, playbook_id, version, name, description, persona,
         topics, instructions, policies, actions, escalation_triggers,
         end_message, model_tier, change_summary, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        id, tenantId, playbookId, nextVersion,
        playbook.name, playbook.description ?? "", playbook.persona ?? "",
        topics, instructions, policies, actions, escalation_triggers,
        playbook.end_message ?? null, playbook.model_tier ?? null,
        opts.changeSummary ?? null, opts.createdBy ?? null, now,
      ]
    );

    const row = await getOne("SELECT * FROM playbook_versions WHERE id = $1", [id]);
    return parseRow(row as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    await run("DELETE FROM playbook_versions WHERE id = $1", [id]);
  },
};
