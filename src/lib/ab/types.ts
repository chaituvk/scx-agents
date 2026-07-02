export type VariantWeight = { variantId: string; weight: number };

export interface Experiment {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  variants: VariantWeight[];
  metricGoal: string; // e.g. 'resolution_rate', 'csat', 'avg_turns'
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface ExperimentAssignment {
  experimentId: string;
  conversationId: string;
  variantId: string;
  assignedAt: string;
}
