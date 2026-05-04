// Shared types for the Orchestrator architecture.
//
// Layering (high → low):
//   Orchestrator → SubAgent → Skill → (LLM via ModelRouter | Tool | RAG)
//
// Cross-cutting services: MemoryService, PolicyChecker, AuditStore, Supervisor.

import type { Message } from "../repositories/message";

// ────────────────────────────────────────────────────────────────────────────
// Model routing
// ────────────────────────────────────────────────────────────────────────────

export type ModelTier = "small" | "reasoning" | "large";

export interface ModelCallOptions {
  tier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Skills (primitives)
// ────────────────────────────────────────────────────────────────────────────

export type SkillName =
  | "triage"
  | "retrieve"
  | "extract_slot"
  | "respond"
  | "confirm"
  | "act"
  | "summarize";

export interface Skill<I, O> {
  readonly name: SkillName;
  run(input: I, ctx: SkillContext): Promise<O>;
}

export interface SkillContext {
  conversationId: string;
  tenantId: string;
  /** Audit hook — skills emit events via this. */
  audit: AuditEmitter;
}

// Concrete I/O for built-in skills
export interface TriageInput {
  message: string;
  history: Message[];
  knownIntents: string[];
  /**
   * Session context — when a workflow is already active, triage should
   * default to continuing it unless the user clearly switches topic.
   */
  session?: {
    activeJourneyId?: string | null;
    currentNodeId?: string | null;
    activeAgent?: SubAgentName | null;
    lastIntent?: string | null;
    topicStackDepth?: number;
  };
  /**
   * Tenant intent → journey map (from router runtime profile config.intents).
   * When triage classifies an intent that has a mapped journey, the orchestrator
   * routes there directly. Empty for tenants without a router profile.
   */
  intentMap?: Record<string, string>;
}
export interface TriageOutput {
  intent: string;
  journeyId?: string;
  specialistId?: string;
  subAgent: SubAgentName;
  confidence: number;
  rationale?: string;
}

export interface RetrieveInput {
  query: string;
  topK?: number;
  filters?: Record<string, string>;
}
export interface RetrievePassage {
  source: string;
  title: string;
  content: string;
  score: number;
}
export interface RetrieveOutput {
  passages: RetrievePassage[];
}

export interface ExtractSlotInput {
  message: string;
  slotSchema: Record<string, { type: "string" | "number" | "boolean"; description: string }>;
}
export interface ExtractSlotOutput {
  slots: Record<string, string | number | boolean>;
}

export interface RespondInput {
  systemPrompt: string;
  userMessage: string;
  history: Message[];
  passages?: RetrievePassage[];
  variables?: Record<string, string>;
}
export interface RespondOutput {
  content: string;
  citations?: string[];
}

export interface ConfirmInput {
  proposedAction: { tool: string; params: Record<string, unknown> };
  summary: string;
}
export interface ConfirmOutput {
  prompt: string;
  pendingActionId: string;
}

export interface ActInput {
  tool: string;
  params: Record<string, unknown>;
}
export interface ActOutput {
  result: unknown;
  ok: boolean;
}

export interface SummarizeInput {
  history: Message[];
  maxTokens?: number;
}
export interface SummarizeOutput {
  summary: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Profiles (LLM personas with system prompt)
// ────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  systemPrompt: string;
  tier: ModelTier;
  /** Optional JSON output schema for structured calls. */
  outputSchema?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Memory
// ────────────────────────────────────────────────────────────────────────────

export type MemoryLayer = "ephemeral" | "profile" | "history" | "knowledge";

export interface MemoryQuery {
  tenantId: string;
  conversationId: string;
  customerId?: string;
  topics?: string[];
  layers?: MemoryLayer[];
}

export interface MemoryContext {
  ephemeral: Record<string, unknown>;
  profile?: { id: string; name?: string; email?: string; tier?: string };
  history: Message[];
  knowledge: RetrievePassage[];
}

// ────────────────────────────────────────────────────────────────────────────
// Policy
// ────────────────────────────────────────────────────────────────────────────

export type PolicyDecision =
  | { decision: "allow" }
  | { decision: "deny"; reason: string }
  | { decision: "require_approval"; reason: string; approver?: string };

export interface PolicyCheckSlotInput {
  journeyId: string;
  slotName: string;
  value: string | number | boolean;
  variables: Record<string, string>;
}

export interface PolicyCheckToolInput {
  tool: string;
  params: Record<string, unknown>;
  variables: Record<string, string>;
}

export interface PolicyCheckResponseInput {
  content: string;
  citations?: string[];
  variables: Record<string, string>;
}

// ────────────────────────────────────────────────────────────────────────────
// Audit
// ────────────────────────────────────────────────────────────────────────────

export type AuditEventType =
  | "turn_start"
  | "turn_end"
  | "route_decision"
  | "slot_write"
  | "tool_call"
  | "policy_event"
  | "journey_transition"
  | "supervisor_check"
  | "escalation_handoff";

export interface AuditEvent {
  id: string;
  conversationId: string;
  tenantId: string;
  ts: string;
  type: AuditEventType;
  payload: Record<string, unknown>;
}

export interface AuditEmitter {
  emit(type: AuditEventType, payload: Record<string, unknown>): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Session state — single object per (tenant_id, conversation_id) replacing the
// scattered dialog_state / conversation fields. Persisted on the dialog_states
// row (extended with nullable JSONB columns); stage 3+ wires this into the
// orchestrator turn contract.
// ────────────────────────────────────────────────────────────────────────────

export interface PendingAction {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  createdAt: string;
}

export interface PendingApproval {
  id: string;
  reason: string;
  approver?: string;
  target: string;
  createdAt: string;
}

export interface TopicFrame {
  intent: string;
  journeyId?: string;
  nodeId?: string;
  pushedAt: string;
}

export interface HandoffState {
  active: boolean;
  reason?: string;
  targetSubAgent?: SubAgentName;
  toHuman?: boolean;
}

export interface SessionState {
  tenantId: string;
  conversationId: string;
  activeAgent: SubAgentName | null;
  activeJourneyId: string | null;
  currentNodeId: string | null;
  slots: Record<string, string | number | boolean>;
  pendingAction: PendingAction | null;
  pendingApproval: PendingApproval | null;
  lastIntent: string | null;
  topicStack: TopicFrame[];
  handoffState: HandoffState;
  auditTraceId: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-agents
// ────────────────────────────────────────────────────────────────────────────

export type SubAgentName = "rag" | "workflow" | "tool" | "escalation";

export interface SubAgentRunInput {
  message: string;
  triage: TriageOutput;
  context: MemoryContext;
  variables: Record<string, string>;
}

export interface SubAgentRunOutput {
  response: string;
  variables: Record<string, string>;
  toolCalls?: Array<{ tool: string; params: Record<string, unknown>; result: unknown }>;
  citations?: string[];
  done: boolean;
  actions: Array<{ type: string; payload: Record<string, unknown> }>;
  /** If a confirmation gate is open, the action is pending until next turn. */
  pendingAction?: { id: string; tool: string; params: Record<string, unknown> };
}

export interface SubAgent {
  readonly name: SubAgentName;
  canHandle(triage: TriageOutput): boolean;
  run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput>;
}

// ────────────────────────────────────────────────────────────────────────────
// Supervisor
// ────────────────────────────────────────────────────────────────────────────

export interface SupervisorCheckInput {
  response: string;
  citations?: string[];
  passages?: RetrievePassage[];
  variables: Record<string, string>;
}

export interface SupervisorCheckOutput {
  pass: boolean;
  issues: Array<{ kind: "pii" | "off_topic" | "ungrounded" | "tone" | "policy"; detail: string }>;
  rewrittenContent?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator turn
// ────────────────────────────────────────────────────────────────────────────

export interface OrchestratorTurnInput {
  conversationId: string;
  tenantId: string;
  customerId?: string;
  message: string;
  /** Existing dialog state (slots, journey position) if any. */
  variables?: Record<string, string>;
  /**
   * Caller-supplied routing hints. Used by /api/dialog/execute and
   * /api/dialog/stream adapters to bypass triage when the journey is already
   * known. When set, triage is skipped and the orchestrator routes directly
   * to the named sub-agent / journey.
   */
  requestedJourneyId?: string;
  forceSubAgent?: SubAgentName;
}

export interface OrchestratorTurnOutput {
  response: string;
  subAgent: SubAgentName;
  intent: string;
  variables: Record<string, string>;
  toolCalls?: Array<{ tool: string; params: Record<string, unknown>; result: unknown }>;
  citations?: string[];
  supervisor: SupervisorCheckOutput;
  done: boolean;
  actions: Array<{ type: string; payload: Record<string, unknown> }>;
}
