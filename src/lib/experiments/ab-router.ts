// Playbook A/B testing router.
//
// Checks if any active experiment targets playbooks for this tenant.
// If found, assigns the conversation to a variant (sticky via experiment_assignments)
// and returns the playbook_id for the assigned variant.
//
// Variant format in experiments.variants:
//   [{ id: "control", playbook_id: "...", weight: 50 },
//    { id: "challenger", playbook_id: "...", weight: 50 }]

import { query, getOne, run } from "@/lib/db";
import { randomUUID } from "crypto";

interface ExperimentVariant {
  id: string;
  playbook_id: string;
  weight: number; // 0-100, weights should sum to 100
}

interface ActiveExperiment {
  id: string;
  variants: ExperimentVariant[];
}

function pickVariant(variants: ExperimentVariant[], conversationId: string): ExperimentVariant {
  // Deterministic hash-based selection so the same conversation always gets
  // the same variant even if there's no DB assignment yet.
  let hash = 0;
  for (let i = 0; i < conversationId.length; i++) {
    hash = (hash * 31 + conversationId.charCodeAt(i)) >>> 0;
  }

  const total = variants.reduce((s, v) => s + v.weight, 0) || 100;
  const bucket = hash % total;
  let acc = 0;
  for (const v of variants) {
    acc += v.weight;
    if (bucket < acc) return v;
  }
  return variants[variants.length - 1];
}

export async function getPlaybookVariant(
  tenantId: string,
  conversationId: string,
): Promise<string | null> {
  // Find an active playbook experiment
  const expRow = await getOne(
    `SELECT id, variants FROM experiments
     WHERE tenant_id = $1 AND status = 'active'
     AND metric_goal = 'playbook_performance'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId]
  ).catch(() => null);

  if (!expRow) return null;

  const exp = expRow as Record<string, unknown>;
  let variants: ExperimentVariant[] = [];
  try {
    variants = typeof exp.variants === "string"
      ? JSON.parse(exp.variants as string)
      : (exp.variants as ExperimentVariant[]) ?? [];
  } catch { return null; }

  if (variants.length === 0) return null;

  const experimentId = exp.id as string;

  // Check if this conversation already has an assignment (sticky)
  const existing = await getOne(
    `SELECT variant_id FROM experiment_assignments WHERE experiment_id = $1 AND conversation_id = $2`,
    [experimentId, conversationId]
  ).catch(() => null);

  if (existing) {
    const existingVariantId = (existing as Record<string, string>).variant_id;
    const assigned = variants.find(v => v.id === existingVariantId);
    return assigned?.playbook_id ?? null;
  }

  // Assign deterministically, then persist for stickiness
  const chosen = pickVariant(variants, conversationId);
  await run(
    `INSERT INTO experiment_assignments (id, experiment_id, conversation_id, variant_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (experiment_id, conversation_id) DO NOTHING`,
    [randomUUID(), experimentId, conversationId, chosen.id]
  ).catch(() => {});

  return chosen.playbook_id;
}

export async function recordExperimentOutcome(
  tenantId: string,
  conversationId: string,
  outcome: "resolved" | "escalated" | "completed",
): Promise<void> {
  // Update the assignment with the outcome so analytics can compute per-variant win rates
  await query(
    `UPDATE experiment_assignments
     SET outcome = $1, outcome_at = NOW()
     WHERE conversation_id = $2
     AND experiment_id IN (SELECT id FROM experiments WHERE tenant_id = $3)`,
    [outcome, conversationId, tenantId]
  ).catch(() => {});
}
