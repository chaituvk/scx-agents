// Sub-agent registry — central lookup and selector for SubAgent instances.

import { ragAgent } from "./rag-agent";
import { workflowAgent } from "./workflow-agent";
import { toolAgent } from "./tool-agent";
import { escalationAgent } from "./escalation-agent";
import { generalAgent } from "./general-agent";
import { playbookAgent } from "./playbook-agent";
import type { SubAgent, SubAgentName, TriageOutput } from "./types";

export const subAgents: Record<SubAgentName, SubAgent> = {
  rag: ragAgent,
  workflow: workflowAgent,
  tool: toolAgent,
  escalation: escalationAgent,
  general: generalAgent,
  playbook: playbookAgent,
};

export function getSubAgent(name: SubAgentName): SubAgent {
  const a = subAgents[name];
  if (!a) throw new Error(`SubAgent '${name}' not found`);
  return a;
}

export function selectSubAgent(triage: TriageOutput): SubAgent {
  for (const agent of Object.values(subAgents)) {
    if (agent.canHandle(triage)) return agent;
  }
  throw new Error(`No SubAgent can handle triage subAgent='${triage.subAgent}'`);
}

export { ragAgent, workflowAgent, toolAgent, escalationAgent, generalAgent, playbookAgent };
