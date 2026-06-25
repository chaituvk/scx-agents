import { query, getOne, run } from '@/lib/db';
import type { Experiment, ExperimentAssignment } from './types';

// Deterministic variant assignment — consistent for the same conversationId
function assignVariant(conversationId: string, variants: { variantId: string; weight: number }[]): string {
  // Simple hash of conversationId for determinism
  let hash = 0;
  for (let i = 0; i < conversationId.length; i++) {
    hash = ((hash << 5) - hash) + conversationId.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash) / 2147483647; // normalize to 0-1

  let cumulative = 0;
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  for (const variant of variants) {
    cumulative += variant.weight / total;
    if (normalized <= cumulative) return variant.variantId;
  }
  return variants[variants.length - 1].variantId;
}

export async function getActiveExperiments(tenantId: string): Promise<Experiment[]> {
  try {
    const result = await query(
      "SELECT * FROM experiments WHERE tenant_id = $1 AND status = 'active'",
      [tenantId]
    );
    return result.rows.map(r => ({
      ...r,
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : r.variants,
    }));
  } catch {
    return []; // table may not exist yet
  }
}

export async function assignToExperiments(
  tenantId: string,
  conversationId: string,
): Promise<Record<string, string>> {
  const experiments = await getActiveExperiments(tenantId);
  const assignments: Record<string, string> = {};

  for (const exp of experiments) {
    const variantId = assignVariant(conversationId, exp.variants);
    assignments[exp.id] = variantId;

    // Persist assignment
    try {
      await run(
        `INSERT INTO experiment_assignments (id, experiment_id, conversation_id, variant_id, assigned_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [crypto.randomUUID(), exp.id, conversationId, variantId, new Date().toISOString()]
      );
    } catch { /* ignore — table may not exist */ }
  }

  return assignments;
}

export async function getAssignment(
  conversationId: string,
  experimentId: string,
): Promise<ExperimentAssignment | null> {
  try {
    const row = await getOne(
      "SELECT * FROM experiment_assignments WHERE conversation_id = $1 AND experiment_id = $2",
      [conversationId, experimentId]
    );
    return row as ExperimentAssignment | null;
  } catch {
    return null;
  }
}
