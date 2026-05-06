import { chat } from "@/lib/llm";
import { retrieveKnowledge } from "@/lib/rag";
import type { DialogAction, DialogResult } from "@/lib/dialog/engine";
import type { DialogState, FlowEdge, FlowNode, Journey } from "@/lib/dialog/types";
import type { ConditionExpression } from "@/lib/journey/schema";
import { checkRuntimeProfile, executeProfileTool, type TenantRuntime } from "./tenant-runtime";
import type { RuntimeDecision } from "./profiles";

type Action = DialogAction | { type: "policy_decision" | "tool_result" | "knowledge_used"; payload: Record<string, unknown> };

interface StepResult {
  messages: string[];
  actions: Action[];
  done: boolean;
  wait: boolean;
}

interface HybridResult extends Omit<DialogResult, "actions"> {
  actions: Action[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function interpolateValue(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

function interpolateObject(input: unknown, variables: Record<string, string>): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, interpolateValue(value, variables)])
  );
}

function decisionPayload(decision: RuntimeDecision, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    allowed: decision.allowed,
    effect: decision.effect,
    reason: decision.reason,
    policyId: decision.policyId,
    ...extra,
  };
}

export class NodeLevelHybridExecutor {
  constructor(
    private readonly journey: Journey,
    private readonly runtime: TenantRuntime
  ) {}

  start(state: DialogState): Promise<HybridResult> {
    const startNode = this.journey.nodes.find((n) => n.type === "start");
    if (!startNode) {
      return Promise.resolve({ messages: ["Error: No start node found"], state, done: true, actions: [] });
    }
    state.currentNodeId = startNode.id;
    return this.processNodeChain(state);
  }

  async handleInput(state: DialogState, userMessage: string): Promise<HybridResult> {
    state.context.lastMessage = userMessage;
    const currentNode = this.getNode(state.currentNodeId);
    if (!currentNode) {
      return { messages: ["Error: Invalid state"], state, done: true, actions: [] };
    }

    if (currentNode.type === "input") {
      const variable = typeof currentNode.data.variable === "string" ? currentNode.data.variable : "user_input";
      state.variables[variable] = userMessage;
    }

    const advanced = this.advance(state, userMessage);
    if (advanced.done) {
      return { messages: [], state, done: true, actions: [] };
    }
    return this.processNodeChain(state);
  }

  private async processNodeChain(state: DialogState): Promise<HybridResult> {
    const messages: string[] = [];
    const actions: Action[] = [];
    let maxIterations = 100;

    while (maxIterations-- > 0) {
      const result = await this.processNode(state);
      messages.push(...result.messages);
      actions.push(...result.actions);

      if (result.done || result.wait) {
        return { messages, state, done: result.done, actions };
      }

      const advanced = this.advance(state);
      if (advanced.done) {
        return { messages, state, done: true, actions };
      }
    }

    actions.push({ type: "policy_decision", payload: { effect: "deny", reason: "Hybrid execution exceeded iteration limit" } });
    return { messages, state, done: false, actions };
  }

  private async processNode(state: DialogState): Promise<StepResult> {
    const node = this.getNode(state.currentNodeId);
    if (!node) return { messages: [], actions: [], done: true, wait: false };

    switch (node.type) {
      case "start":
      case "condition":
        return { messages: [], actions: [], done: false, wait: false };

      case "message":
        return {
          messages: [this.interpolate(String(node.data.text || ""), state.variables)],
          actions: [],
          done: false,
          wait: false,
        };

      case "input":
        return {
          messages: [this.interpolate(String(node.data.prompt || "Please provide the requested information."), state.variables)],
          actions: [{ type: "wait_input", payload: { variable: node.data.variable } }],
          done: false,
          wait: true,
        };

      case "action":
        return this.processActionNode(node, state);

      case "api":
        return this.processLegacyApiNode(node, state);

      case "llm_extract":
        return this.processLlmExtractNode(node, state);

      case "tool_call":
        return this.processToolCallNode(node, state);

      case "policy_check":
        return this.processPolicyCheckNode(node, state);

      case "llm_draft":
        return this.processLlmDraftNode(node, state);

      case "intent": {
        const intent = this.classifyIntent(String(state.context.lastMessage || ""));
        state.context.detectedIntent = intent;
        state.variables.detected_intent = intent;
        return { messages: [], actions: [], done: false, wait: false };
      }

      case "transfer": {
        const reason = String(node.data.reason || "Escalated by hybrid journey");
        return {
          messages: [`I'm transferring you to a human agent. ${reason}`],
          actions: [{ type: "transfer", payload: { reason, department: node.data.department } }],
          done: true,
          wait: false,
        };
      }

      case "end":
        return {
          messages: [this.interpolate(String(node.data.text || "Thank you for chatting with us!"), state.variables)],
          actions: [],
          done: true,
          wait: false,
        };
    }
  }

  private processActionNode(node: FlowNode, state: DialogState): StepResult {
    if (node.data.action === "set_variable" && typeof node.data.variable === "string") {
      state.variables[node.data.variable] = String(interpolateValue(node.data.value, state.variables) ?? "");
      return {
        messages: [],
        actions: [{ type: "set_variable", payload: { variable: node.data.variable, value: state.variables[node.data.variable] } }],
        done: false,
        wait: false,
      };
    }
    return { messages: [], actions: [], done: false, wait: false };
  }

  private processLegacyApiNode(node: FlowNode, state: DialogState): StepResult {
    const endpoint = String(node.data.endpoint || "");
    const messages: string[] = [];
    if (endpoint === "/api/kyc/verify") {
      const ssn = state.variables.ssn_last4 || "0000";
      const lastDigit = parseInt(ssn.slice(-1)) || 0;
      if (lastDigit >= 8) {
        state.variables.kyc_status = "rejected";
        state.variables.risk_score = "85";
        messages.push("Verification alert: Additional review required.");
      } else if (lastDigit >= 5) {
        state.variables.kyc_status = "pending";
        state.variables.risk_score = "50";
        messages.push("Verification in progress. Your information is being reviewed.");
      } else {
        state.variables.kyc_status = "verified";
        state.variables.risk_score = "20";
        messages.push("Identity verification completed.");
      }
    }

    return {
      messages,
      actions: [{ type: "api_call", payload: { endpoint, result: state.variables.kyc_status } }],
      done: false,
      wait: false,
    };
  }

  private async processLlmExtractNode(node: FlowNode, state: DialogState): Promise<StepResult> {
    const profile = String(node.data.profile || "");
    const slots = asStringArray(node.data.allowed_slots || node.data.writes || node.data.slots);
    if (slots.length === 0) {
      return { messages: [], actions: [{ type: "policy_decision", payload: { effect: "deny", reason: "llm_extract node has no allowed slots" } }], done: false, wait: false };
    }

    const permission = checkRuntimeProfile(this.runtime, profile, { journeyId: this.journey.id, slotWrites: slots, variables: state.variables });
    if (permission.effect === "deny" || permission.effect === "escalate") {
      return { messages: [], actions: [{ type: "policy_decision", payload: decisionPayload(permission) }], done: permission.effect === "escalate", wait: false };
    }

    const userMessage = String(state.context.lastMessage || "");
    if (!userMessage) {
      return { messages: [], actions: [{ type: "wait_input", payload: { reason: "llm_extract_needs_user_message" } }], done: false, wait: true };
    }

    const response = await chat([
      { role: "system", content: `Extract only these slots as JSON: ${slots.join(", ")}. Return valid JSON only. Do not invent unknown values.` },
      { role: "user", content: userMessage },
    ]);
    const extracted = response.model === "mock" ? this.fallbackExtract(userMessage, slots) : parseJsonObject(response.content);
    const actions: Action[] = [];

    for (const slot of slots) {
      const value = extracted[slot];
      if (value === undefined || value === null || value === "") continue;
      state.variables[slot] = String(value);
      actions.push({ type: "set_variable", payload: { variable: slot, value: state.variables[slot], source: "llm_extract", profile } });
    }

    const policy = checkRuntimeProfile(this.runtime, profile, { journeyId: this.journey.id, slotWrites: slots, variables: state.variables });
    if (policy.effect !== "allow") {
      actions.push({ type: "policy_decision", payload: decisionPayload(policy) });
    }

    return { messages: [], actions, done: false, wait: false };
  }

  private async processToolCallNode(node: FlowNode, state: DialogState): Promise<StepResult> {
    const profile = String(node.data.profile || "");
    const tool = String(node.data.tool || "");
    const params = interpolateObject(node.data.input || node.data.params, state.variables);
    const { decision, result } = await executeProfileTool(this.runtime, profile, tool, params, state.variables);

    if (!decision.allowed) {
      return {
        messages: [],
        actions: [{ type: "policy_decision", payload: decisionPayload(decision, { tool, profile }) }],
        done: decision.effect === "escalate",
        wait: false,
      };
    }

    this.mapToolOutput(node.data.output_map, result, state);
    return {
      messages: [],
      actions: [
        { type: "api_call", payload: { endpoint: tool, profile } },
        { type: "tool_result", payload: { tool, profile, result: result && typeof result === "object" ? result : String(result) } },
      ],
      done: false,
      wait: false,
    };
  }

  private processPolicyCheckNode(node: FlowNode, state: DialogState): StepResult {
    const profile = String(node.data.profile || "");
    const decision = checkRuntimeProfile(this.runtime, profile, { journeyId: this.journey.id, variables: state.variables });
    state.context.lastPolicyDecision = decision;

    if (decision.effect === "require_approval") {
      // Pause execution. The journey stays parked on this node — workflow-agent
      // persists pending_approval and the orchestrator short-circuits new
      // turns until POST /api/orchestrator/approve resumes (advances past
      // this node) or rejects (sets approval_denied).
      state.variables.approval_required = "true";
      return {
        messages: decision.reason ? [decision.reason] : ["This step requires supervisor approval."],
        actions: [{
          type: "policy_decision",
          payload: decisionPayload(decision, { profile, paused: true, nodeId: node.id }),
        }],
        done: false,
        wait: true,
      };
    }

    if (decision.effect === "escalate") {
      state.variables.escalation_required = "true";
    }
    return {
      messages: decision.reason ? [decision.reason] : [],
      actions: decision.effect === "allow" ? [] : [{ type: "policy_decision", payload: decisionPayload(decision, { profile, nodeId: node.id }) }],
      done: false,
      wait: false,
    };
  }

  private async processLlmDraftNode(node: FlowNode, state: DialogState): Promise<StepResult> {
    const profile = String(node.data.profile || "");
    const decision = checkRuntimeProfile(this.runtime, profile, { journeyId: this.journey.id, variables: state.variables });
    if (decision.effect === "deny" || decision.effect === "escalate") {
      return { messages: [], actions: [{ type: "policy_decision", payload: decisionPayload(decision) }], done: decision.effect === "escalate", wait: false };
    }

    const instruction = String(node.data.instruction || "Draft a concise, compliant customer-facing response using the known variables.");
    const forbidden = asStringArray(node.data.must_not_claim || node.data.forbidden_claims);

    // Stage 13: ground the draft in tenant-scoped RAG passages unless the
    // node opts out via data.retrieve === false. Query order:
    //   1) explicit data.retrieval_query (interpolated with variables)
    //   2) the user's last message (typical chat flow)
    //   3) the node's instruction (fallback when there's no user turn yet)
    const retrieveEnabled = node.data.retrieve !== false;
    const retrievalQueryRaw = String(
      node.data.retrieval_query
      || state.context.lastMessage
      || instruction
      || ""
    );
    const retrievalQuery = this.interpolate(retrievalQueryRaw, state.variables);
    const topK = typeof node.data.retrieval_top_k === "number" ? node.data.retrieval_top_k : 3;

    let passagesBlock = "";
    let citations: string[] = [];
    if (retrieveEnabled && retrievalQuery.trim().length > 0) {
      try {
        const docs = await retrieveKnowledge(retrievalQuery, topK, this.runtime.tenantId);
        if (docs.length > 0) {
          passagesBlock = `\nRELEVANT KNOWLEDGE (ground your draft in these and cite sources inline as [source]):\n${docs
            .map((d) => `[${d.source}] ${d.title}: ${d.content}`)
            .join("\n")}\n`;
          citations = Array.from(new Set(docs.map((d) => d.source)));
        }
      } catch {
        // Retrieval is best-effort. A miss falls back to the un-grounded
        // draft path; the supervisor's groundedness check still applies.
      }
    }

    const sysParts = [
      "You are drafting a regulated customer-support response.",
      `Avoid these claims: ${forbidden.join(", ") || "none"}.`,
      passagesBlock
        ? "Ground every factual claim in the provided passages and cite sources inline as [source]. If the passages don't cover the answer, say you'll check rather than inventing details."
        : "",
      "Keep it concise.",
    ].filter(Boolean);

    const response = await chat([
      { role: "system", content: sysParts.join(" ") + passagesBlock },
      { role: "user", content: `${instruction}\n\nVariables:\n${JSON.stringify(state.variables, null, 2)}\n\nLast user message: ${String(state.context.lastMessage || "")}` },
    ]);
    let text = response.model === "mock" ? String(node.data.fallback || "Thanks. I have the details I need and will continue with the next step.") : response.content.trim();
    for (const phrase of forbidden) {
      if (phrase && text.toLowerCase().includes(phrase.toLowerCase())) {
        text = String(node.data.fallback || "I have the details I need and will continue according to policy.");
        break;
      }
    }

    const actions: Action[] = citations.length > 0
      ? [{ type: "knowledge_used", payload: { sources: citations, query: retrievalQuery } }]
      : [];
    return { messages: [text], actions, done: false, wait: false };
  }

  private mapToolOutput(outputMap: unknown, result: unknown, state: DialogState) {
    if (!outputMap || typeof outputMap !== "object" || !result || typeof result !== "object") return;
    for (const [sourceKey, variableName] of Object.entries(outputMap as Record<string, unknown>)) {
      if (typeof variableName !== "string") continue;
      const value = (result as Record<string, unknown>)[sourceKey];
      if (value !== undefined && value !== null) state.variables[variableName] = String(value);
    }
  }

  private fallbackExtract(message: string, slots: string[]): Record<string, unknown> {
    const extracted: Record<string, unknown> = {};
    const number = message.match(/\b\d+(?:\.\d+)?\b/)?.[0];
    const amount = message.match(/\b(?:refund|credit|amount|fee|total)\D{0,20}(\d+(?:\.\d+)?)\b/i)?.[1]
      || message.match(/\b(\d+(?:\.\d+)?)\s*(?:refund|credit|amount|fee|total)\b/i)?.[1];
    for (const slot of slots) {
      const lower = slot.toLowerCase();
      if (lower.includes("amount") && (amount || number)) extracted[slot] = amount || number;
      else if ((lower.includes("order") || lower.includes("ssn")) && number) extracted[slot] = number;
      else if (lower.includes("reason")) extracted[slot] = message;
    }
    return extracted;
  }

  private advance(state: DialogState, userMessage?: string): { done: boolean } {
    const currentNode = this.getNode(state.currentNodeId);
    if (!currentNode) return { done: true };
    state.history.push({ nodeId: currentNode.id, timestamp: new Date().toISOString() });
    const nextNodeId = this.getNextNodeId(currentNode, state, userMessage);
    if (!nextNodeId) return { done: true };
    state.currentNodeId = nextNodeId;
    return { done: false };
  }

  private getNextNodeId(currentNode: FlowNode, state: DialogState, userMessage?: string): string | null {
    const outgoing = this.journey.edges.filter((e) => e.source === currentNode.id);
    if (outgoing.length === 0) return null;
    if (outgoing.length === 1) return outgoing[0].target;

    if (currentNode.type === "condition") {
      const varName = String(currentNode.data.variable || "");
      for (const edge of outgoing) {
        if (edge.condition && this.evaluateCondition(edge.condition, state, varName, state.variables[varName])) {
          return edge.target;
        }
      }
    }

    if (currentNode.type === "intent") {
      const intent = this.classifyIntent(userMessage || String(state.context.lastMessage || ""));
      const match = outgoing.find((edge) => edge.label?.toLowerCase() === intent);
      if (match) return match.target;
    }

    return outgoing.find((e) => !e.condition)?.target || outgoing[0].target;
  }

  private evaluateCondition(condition: FlowEdge["condition"], state: DialogState, defaultVarName?: string, defaultValue?: string): boolean {
    if (!condition) return false;
    if (typeof condition !== "string") return this.evaluateConditionExpression(condition, state);
    const [operator, ...rest] = condition.trim().split(/\s+/);
    const operand = rest.join(" ");
    const value = defaultValue ?? (defaultVarName ? state.variables[defaultVarName] : undefined);
    switch (operator) {
      case "always": return true;
      case "empty": return !value;
      case "not_empty": return Boolean(value);
      case "eq": return String(value ?? "") === operand;
      case "neq": return String(value ?? "") !== operand;
      case "gt": return Number(value) > Number(operand);
      case "gte": return Number(value) >= Number(operand);
      case "lt": return Number(value) < Number(operand);
      case "lte": return Number(value) <= Number(operand);
      case "contains": return String(value ?? "").toLowerCase().includes(operand.toLowerCase());
      default: return false;
    }
  }

  private evaluateConditionExpression(condition: ConditionExpression, state: DialogState): boolean {
    switch (condition.op) {
      case "always": return true;
      case "empty": return !state.variables[condition.var];
      case "not_empty": return Boolean(state.variables[condition.var]);
      case "eq": return String(state.variables[condition.var] ?? "") === String(condition.value);
      case "neq": return String(state.variables[condition.var] ?? "") !== String(condition.value);
      case "gt": return Number(state.variables[condition.var]) > Number(condition.value);
      case "gte": return Number(state.variables[condition.var]) >= Number(condition.value);
      case "lt": return Number(state.variables[condition.var]) < Number(condition.value);
      case "lte": return Number(state.variables[condition.var]) <= Number(condition.value);
      case "contains": return String(state.variables[condition.var] ?? "").toLowerCase().includes(String(condition.value).toLowerCase());
      case "matches": return this.safeRegexMatch(String(condition.value), String(state.variables[condition.var] ?? ""));
      case "and": return condition.conditions.every((c) => this.evaluateConditionExpression(c, state));
      case "or": return condition.conditions.some((c) => this.evaluateConditionExpression(c, state));
      case "not": return !this.evaluateConditionExpression(condition.condition, state);
    }
  }

  private getNode(nodeId: string): FlowNode | undefined {
    return this.journey.nodes.find((n) => n.id === nodeId);
  }

  private safeRegexMatch(pattern: string, value: string): boolean {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return false;
    }
  }

  private interpolate(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
  }

  private classifyIntent(message: string): string {
    const lower = message.toLowerCase();
    if (/\b(return|send back)\b/.test(lower)) return "return";
    if (/\b(refund|money back)\b/.test(lower)) return "refund";
    if (/\b(shipping|delivery|track)\b/.test(lower)) return "shipping";
    if (/\b(price|cost|deal|discount|buy)\b/.test(lower)) return "sales";
    if (/\b(help|support|issue|problem)\b/.test(lower)) return "support";
    return "default";
  }
}
