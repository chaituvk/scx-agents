import { DialogEngine } from "./dialog/engine";
import { runAgentStep, runAgentWelcome, type AgentConfig, type AgentContext, type AgentStep } from "./agent-runtime";
import type { Journey, DialogState as EngineDialogState } from "./dialog/types";

export interface HybridState {
  mode: "journey" | "agent";
  checkpointNodeId?: string;
  agentFreeUntil?: string; // node ID to stop at
}

// Hybrid execution: deterministic checkpoints + LLM free-form between them
export class HybridEngine {
  private journey: Journey;
  private agentConfig: AgentConfig;

  constructor(journey: Journey, agentConfig: AgentConfig) {
    this.journey = journey;
    this.agentConfig = agentConfig;
  }

  // Start: run deterministic nodes until first checkpoint, then switch to agent mode
  async start(state: EngineDialogState): Promise<{ messages: string[]; done: boolean; actions: any[]; hybridState: HybridState }> {
    const engine = new DialogEngine(this.journey);
    const result = engine.start(state);

    // Find first checkpoint (condition, api, transfer, or end)
    const checkpointNode = this.findNextCheckpoint(state.currentNodeId);

    if (!checkpointNode || result.done) {
      return {
        messages: result.messages,
        done: result.done,
        actions: result.actions,
        hybridState: { mode: "journey" },
      };
    }

    // If we hit an interactive node immediately, stay in journey mode
    if (["input", "api", "transfer", "end"].includes(checkpointNode.type)) {
      return {
        messages: result.messages,
        done: result.done,
        actions: result.actions,
        hybridState: { mode: "journey", checkpointNodeId: checkpointNode.id },
      };
    }

    // Switch to agent mode: LLM handles free-form conversation until we reach the checkpoint
    const welcome = await runAgentWelcome(this.agentConfig);
    return {
      messages: [welcome, ...result.messages],
      done: false,
      actions: [{ type: "wait_input", payload: { hint: "free_form" } }],
      hybridState: { mode: "agent", agentFreeUntil: checkpointNode.id },
    };
  }

  // Handle user input in hybrid mode
  async handleInput(
    state: EngineDialogState,
    hybridState: HybridState,
    agentContext: AgentContext,
    userMessage: string
  ): Promise<{ messages: string[]; done: boolean; actions: any[]; hybridState: HybridState; state: EngineDialogState }> {

    if (hybridState.mode === "journey") {
      // Deterministic mode: use DialogEngine
      const engine = new DialogEngine(this.journey);
      const result = engine.handleInput(state, userMessage);

      // After deterministic step, check if we should switch to agent mode
      const nextCheckpoint = this.findNextCheckpoint(state.currentNodeId);
      if (nextCheckpoint && !result.done) {
        return {
          messages: result.messages,
          done: result.done,
          actions: result.actions,
          hybridState: { mode: "agent", agentFreeUntil: nextCheckpoint.id },
          state,
        };
      }

      return {
        messages: result.messages,
        done: result.done,
        actions: result.actions,
        hybridState: { mode: "journey" },
        state,
      };
    }

    // Agent mode: use LLM to generate response
    const step = await runAgentStep(this.agentConfig, agentContext, userMessage);

    // Merge variables back
    Object.assign(state.variables, step.variables);

    // Check if user said something that should trigger a checkpoint
    const shouldSwitchToJourney = this.checkCheckpointTrigger(state, userMessage);
    if (shouldSwitchToJourney) {
      // Switch back to journey mode and advance
      const engine = new DialogEngine(this.journey);
      state.context.lastMessage = userMessage;
      const journeyResult = engine.handleInput(state, userMessage);

      return {
        messages: [...(step.response ? [step.response] : []), ...journeyResult.messages],
        done: journeyResult.done,
        actions: journeyResult.actions,
        hybridState: { mode: "journey", checkpointNodeId: state.currentNodeId },
        state,
      };
    }

    return {
      messages: step.response ? [step.response] : [],
      done: step.done,
      actions: step.actions,
      hybridState,
      state,
    };
  }

  private findNextCheckpoint(fromNodeId: string): any | null {
    const currentNode = this.journey.nodes.find((n) => n.id === fromNodeId);
    if (!currentNode) return null;

    // Check if current node IS a checkpoint
    if (["condition", "api", "transfer", "end", "intent"].includes(currentNode.type)) {
      return currentNode;
    }

    // Find next checkpoint by traversing edges
    const visited = new Set<string>();
    const queue = [fromNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = this.journey.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      if (["condition", "api", "transfer", "end", "intent"].includes(node.type)) {
        return node;
      }

      const outgoing = this.journey.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoing) {
        queue.push(edge.target);
      }
    }

    return null;
  }

  private checkCheckpointTrigger(state: EngineDialogState, message: string): boolean {
    // Heuristic: if the current node is an input node and we've collected the variable,
    // or if the user is explicitly confirming/providing structured data
    const currentNode = this.journey.nodes.find((n) => n.id === state.currentNodeId);
    if (!currentNode) return false;

    // If we're at an input node, the user just provided the input → switch to journey
    if (currentNode.type === "input") {
      return true;
    }

    // If user says something that looks like a confirmation for a condition
    const lower = message.toLowerCase();
    if (lower.match(/\b(yes|no|verified|approved|rejected)\b/)) {
      const nextCheckpoint = this.findNextCheckpoint(currentNode.id);
      if (nextCheckpoint?.type === "condition") {
        return true;
      }
    }

    return false;
  }
}
