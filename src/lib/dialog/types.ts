import type { ConditionExpression } from "@/lib/journey/schema";

export type NodeType = 
  | "start"
  | "intent"
  | "message"
  | "input"
  | "condition"
  | "action"
  | "api"
  | "llm_extract"
  | "llm_draft"
  | "policy_check"
  | "tool_call"
  | "transfer"
  | "end";

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string | ConditionExpression;
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: string[] | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DialogState {
  conversationId: string;
  journeyId: string;
  currentNodeId: string;
  variables: Record<string, string>;
  history: { nodeId: string; timestamp: string }[];
  context: Record<string, unknown>;
}
