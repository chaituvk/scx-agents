export type NodeType = 
  | "start"
  | "intent"
  | "message"
  | "input"
  | "condition"
  | "action"
  | "api"
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
  condition?: string;
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: string[];
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
