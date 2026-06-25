import { query, getOne, run } from '@/lib/db';

export interface PromptVersion {
  id: string;
  tenantId: string;
  agentType: string; // 'rag', 'workflow', 'general', 'triage', etc.
  version: number;
  systemPrompt: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export async function getActivePrompt(tenantId: string, agentType: string): Promise<string | null> {
  try {
    const row = await getOne(
      "SELECT system_prompt FROM prompt_versions WHERE tenant_id = $1 AND agent_type = $2 AND is_active = true ORDER BY version DESC LIMIT 1",
      [tenantId, agentType]
    );
    return row?.system_prompt ?? null;
  } catch {
    return null;
  }
}

export async function createPromptVersion(
  tenantId: string,
  agentType: string,
  systemPrompt: string,
  notes?: string,
): Promise<PromptVersion> {
  // Get current max version
  const maxRow = await getOne(
    "SELECT MAX(version) as max_version FROM prompt_versions WHERE tenant_id = $1 AND agent_type = $2",
    [tenantId, agentType]
  ).catch(() => null);
  const nextVersion = (maxRow?.max_version ?? 0) + 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Deactivate previous versions
  await run(
    "UPDATE prompt_versions SET is_active = false WHERE tenant_id = $1 AND agent_type = $2",
    [tenantId, agentType]
  ).catch(() => {});

  await run(
    `INSERT INTO prompt_versions (id, tenant_id, agent_type, version, system_prompt, is_active, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
    [id, tenantId, agentType, nextVersion, systemPrompt, notes ?? null, now]
  );

  return { id, tenantId, agentType, version: nextVersion, systemPrompt, isActive: true, notes, createdAt: now };
}

export async function listPromptVersions(tenantId: string, agentType: string): Promise<PromptVersion[]> {
  const result = await query(
    "SELECT * FROM prompt_versions WHERE tenant_id = $1 AND agent_type = $2 ORDER BY version DESC",
    [tenantId, agentType]
  ).catch(() => ({ rows: [] }));
  return result.rows as PromptVersion[];
}

export async function activatePromptVersion(tenantId: string, id: string): Promise<void> {
  // Get agent type first
  const pv = await getOne("SELECT agent_type FROM prompt_versions WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!pv) throw new Error('Prompt version not found');

  // Deactivate all versions for this agent type
  await run("UPDATE prompt_versions SET is_active = false WHERE tenant_id = $1 AND agent_type = $2", [tenantId, pv.agent_type]);
  // Activate the selected one
  await run("UPDATE prompt_versions SET is_active = true WHERE id = $1", [id]);
}
