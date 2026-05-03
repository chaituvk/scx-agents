import { FlowNode, FlowEdge, DialogState, Journey } from "./types";

export interface DialogResult {
  messages: string[];
  state: DialogState;
  done: boolean;
  actions: DialogAction[];
}

export interface DialogAction {
  type: "api_call" | "transfer" | "set_variable" | "wait_input";
  payload: Record<string, unknown>;
}

export class DialogEngine {
  private journey: Journey;

  constructor(journey: Journey) {
    this.journey = journey;
  }

  static createState(conversationId: string, journeyId: string): DialogState {
    return {
      conversationId,
      journeyId,
      currentNodeId: "",
      variables: {},
      history: [],
      context: {},
    };
  }

  start(state: DialogState): DialogResult {
    const startNode = this.journey.nodes.find((n) => n.type === "start");
    if (!startNode) {
      return { messages: ["Error: No start node found"], state, done: true, actions: [] };
    }
    state.currentNodeId = startNode.id;
    return this.processNodeChain(state);
  }

  handleInput(state: DialogState, userMessage: string): DialogResult {
    const currentNode = this.journey.nodes.find((n) => n.id === state.currentNodeId);
    if (!currentNode) {
      return { messages: ["Error: Invalid state"], state, done: true, actions: [] };
    }

    // If current node expects input, store it
    if (currentNode.type === "input") {
      const varName = (currentNode.data.variable as string) || "user_input";
      state.variables[varName] = userMessage;
    }

    // Move to next node and chain process
    const result = this.advance(state, userMessage);
    if (result.messages.length === 0 && !result.done && result.actions.length === 0) {
      return this.processNodeChain(state);
    }
    return result;
  }

  private advance(state: DialogState, userMessage?: string): DialogResult {
    const currentNode = this.journey.nodes.find((n) => n.id === state.currentNodeId);
    if (!currentNode) {
      return { messages: [], state, done: true, actions: [] };
    }

    // Record history
    state.history.push({ nodeId: currentNode.id, timestamp: new Date().toISOString() });

    // Find next node
    const nextNodeId = this.getNextNodeId(currentNode, state, userMessage);
    if (!nextNodeId) {
      return { messages: [], state, done: true, actions: [] };
    }

    state.currentNodeId = nextNodeId;
    return { messages: [], state, done: false, actions: [] };
  }

  private processNodeChain(state: DialogState): DialogResult {
    const allMessages: string[] = [];
    const allActions: DialogAction[] = [];
    let maxIterations = 20;

    while (maxIterations-- > 0) {
      const result = this.processNode(state);
      allMessages.push(...result.messages);
      allActions.push(...result.actions);

      if (result.done) {
        return { messages: allMessages, state, done: true, actions: allActions };
      }

      // Stop chaining if we hit an interactive node (input, api, transfer)
      const blockingActions = result.actions.filter((a) => a.type !== "set_variable");
      if (blockingActions.length > 0) {
        return { messages: allMessages, state, done: false, actions: allActions };
      }

      // Auto-advance for message/action/condition/start nodes
      const currentNode = this.journey.nodes.find((n) => n.id === state.currentNodeId);
      if (!currentNode || ["input", "transfer", "end", "api"].includes(currentNode.type)) {
        return { messages: allMessages, state, done: false, actions: allActions };
      }

      const advanceResult = this.advance(state);
      if (advanceResult.done) {
        return { messages: allMessages, state, done: true, actions: allActions };
      }
    }

    return { messages: allMessages, state, done: false, actions: allActions };
  }

  private processNode(state: DialogState): DialogResult {
    const node = this.journey.nodes.find((n) => n.id === state.currentNodeId);
    if (!node) {
      return { messages: [], state, done: true, actions: [] };
    }

    const messages: string[] = [];
    const actions: DialogAction[] = [];

    switch (node.type) {
      case "start":
        return { messages, state, done: false, actions };

      case "message": {
        const text = this.interpolate(node.data.text as string, state.variables);
        messages.push(text);
        return { messages, state, done: false, actions };
      }

      case "input": {
        const prompt = this.interpolate(node.data.prompt as string, state.variables);
        messages.push(prompt);
        actions.push({ type: "wait_input", payload: { variable: node.data.variable } });
        return { messages, state, done: false, actions };
      }

      case "intent": {
        const intent = this.classifyIntent(state.context.lastMessage as string || "");
        state.context.detectedIntent = intent;
        return { messages, state, done: false, actions };
      }

      case "condition": {
        return { messages, state, done: false, actions };
      }

      case "action": {
        const actionType = node.data.action as string;
        if (actionType === "set_variable") {
          state.variables[node.data.variable as string] = node.data.value as string;
        }
        actions.push({
          type: "set_variable",
          payload: { variable: node.data.variable, value: node.data.value },
        });
        return { messages, state, done: false, actions };
      }

      case "api": {
        const endpoint = node.data.endpoint as string;
        // Simulate API call result for KYC verification
        if (endpoint === "/api/kyc/verify") {
          const params = node.data.params as string[];
          const payload: Record<string, string> = {};
          params.forEach((p) => { payload[p] = state.variables[p] || ""; });

          // Deterministic mock based on SSN last 4
          const ssn = payload.ssn_last4 || "0000";
          const lastDigit = parseInt(ssn.slice(-1)) || 0;

          if (lastDigit >= 8) {
            state.variables.kyc_status = "rejected";
            state.variables.risk_score = "85";
            messages.push("⚠️ Verification alert: Additional review required.");
          } else if (lastDigit >= 5) {
            state.variables.kyc_status = "pending";
            state.variables.risk_score = "50";
            messages.push("⏳ Verification in progress. Your information is being reviewed.");
          } else {
            state.variables.kyc_status = "verified";
            state.variables.risk_score = "20";
            messages.push("✅ Identity verification completed.");
          }
        }
        actions.push({
          type: "api_call",
          payload: { endpoint, result: state.variables.kyc_status },
        });
        return { messages, state, done: false, actions };
      }

      case "transfer": {
        const reason = node.data.reason as string || "Escalated by dialog flow";
        messages.push(`I'm transferring you to a human agent. ${reason}`);
        actions.push({ type: "transfer", payload: { reason, department: node.data.department } });
        return { messages, state, done: true, actions };
      }

      case "end": {
        const endMessage = this.interpolate((node.data.text as string) || "Thank you for chatting with us!", state.variables);
        messages.push(endMessage);
        return { messages, state, done: true, actions };
      }

      default:
        return { messages, state, done: false, actions };
    }
  }

  private getNextNodeId(currentNode: FlowNode, state: DialogState, userMessage?: string): string | null {
    const outgoing = this.journey.edges.filter((e) => e.source === currentNode.id);

    if (outgoing.length === 0) return null;
    if (outgoing.length === 1) return outgoing[0].target;

    // Multiple edges — find matching condition
    if (currentNode.type === "condition") {
      const condition = currentNode.data.condition as string;
      const varName = currentNode.data.variable as string;
      const varValue = state.variables[varName];

      for (const edge of outgoing) {
        if (edge.condition && this.evaluateCondition(edge.condition, varValue)) {
          return edge.target;
        }
      }
    }

    if (currentNode.type === "intent") {
      const intent = this.classifyIntent(userMessage || "");
      for (const edge of outgoing) {
        if (edge.label?.toLowerCase() === intent) {
          return edge.target;
        }
      }
    }

    // Default to first edge with no condition, or just first edge
    const defaultEdge = outgoing.find((e) => !e.condition) || outgoing[0];
    return defaultEdge?.target || null;
  }

  private evaluateCondition(condition: string, value: string | undefined): boolean {
    if (!value) return false;
    const [operator, operand] = condition.split(" ");
    switch (operator) {
      case "eq": return value === operand;
      case "neq": return value !== operand;
      case "gt": return parseFloat(value) > parseFloat(operand);
      case "lt": return parseFloat(value) < parseFloat(operand);
      case "contains": return value.toLowerCase().includes(operand.toLowerCase());
      default: return false;
    }
  }

  private classifyIntent(message: string): string {
    const lower = message.toLowerCase();
    if (/\b(hi|hello|hey)\b/.test(lower)) return "greeting";
    if (/\b(return|send back)\b/.test(lower)) return "return";
    if (/\b(refund|money back)\b/.test(lower)) return "refund";
    if (/\b(shipping|delivery|track)\b/.test(lower)) return "shipping";
    if (/\b(price|cost|deal|discount|buy)\b/.test(lower)) return "sales";
    if (/\b(help|support|issue|problem)\b/.test(lower)) return "support";
    return "default";
  }

  private interpolate(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
  }
}
