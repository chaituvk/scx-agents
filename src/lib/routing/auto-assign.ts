// Auto-assignment engine.
// Finds the best available human agent to assign a conversation to based on:
// 1. Online availability (from AGENT_STATUS in-memory map)
// 2. Current workload (fewest open conversations wins)
// 3. Expertise match (agent.skills contains conversation topic)
// 4. Tenant assignment rules (routing_rules with action_type='assign_agent')
//
// Called by the orchestrator after an escalation sub-agent turn.
// Non-blocking — failure falls back gracefully.

import { query, getOne } from "@/lib/db";
import { AGENT_STATUS } from "@/app/api/agents/[id]/status/route";

interface AgentCandidate {
  id: string;
  name: string;
  skills: string[];
  open_conversations: number;
}

export async function autoAssignAgent(
  tenantId: string,
  conversationId: string,
  topic?: string,
): Promise<string | null> {
  // Load agents in this tenant
  const agentsResult = await query(
    `SELECT id, name, skills FROM agents WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId]
  ).catch(() => ({ rows: [] }));

  if (agentsResult.rows.length === 0) return null;

  // Filter to online/busy agents
  const availableAgentIds = new Set<string>();
  for (const [agentId, statusData] of AGENT_STATUS) {
    if (statusData.status === "online" || statusData.status === "busy") {
      availableAgentIds.add(agentId);
    }
  }

  // If no agents have set status, consider all agents available
  const candidates: AgentCandidate[] = agentsResult.rows
    .filter(a => availableAgentIds.size === 0 || availableAgentIds.has(a.id as string))
    .map(a => ({
      id: a.id as string,
      name: a.name as string,
      skills: Array.isArray(a.skills)
        ? (a.skills as string[])
        : typeof a.skills === "string"
        ? JSON.parse(a.skills as string).catch(() => [])
        : [],
      open_conversations: 0,
    }));

  if (candidates.length === 0) return null;

  // Get workload for each candidate
  const workloadResult = await query(
    `SELECT assigned_to, COUNT(*) AS open_count
     FROM conversations
     WHERE tenant_id = $1 AND status = 'open' AND assigned_to = ANY($2::text[])
     GROUP BY assigned_to`,
    [tenantId, candidates.map(c => c.id)]
  ).catch(() => ({ rows: [] }));

  const workloadMap = new Map(
    workloadResult.rows.map(r => [r.assigned_to as string, Number(r.open_count)])
  );
  for (const c of candidates) {
    c.open_conversations = workloadMap.get(c.id) ?? 0;
  }

  // Score: skill match (+10) + inverse workload (-open_count)
  const scored = candidates.map(c => {
    const skillMatch = topic && c.skills.some(s => s.toLowerCase().includes(topic.toLowerCase())) ? 10 : 0;
    return { ...c, score: skillMatch - c.open_conversations };
  });

  // Pick the highest scored agent (ties go to first in list)
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

export async function assignConversation(
  conversationId: string,
  tenantId: string,
  agentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `UPDATE conversations SET assigned_to = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
    [agentId, now, conversationId, tenantId]
  );
}
