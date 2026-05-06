import { DialogEngine, type DialogAction } from "@/lib/dialog/engine";
import type { Journey as DialogJourney } from "@/lib/dialog/types";
import { NodeLevelHybridExecutor } from "@/lib/runtime/hybrid-executor";
import { findRuntimeProfile, type RuntimeToolMocks, type TenantRuntime, withRuntimeOverrides } from "@/lib/runtime/tenant-runtime";
import { compileJourney, type JourneyValidationIssue } from "./schema";
import { z } from "zod";

interface JourneyLike {
  id: string;
  name: string;
  execution_mode?: "deterministic" | "llm" | "hybrid" | string;
  nodes: unknown[];
}

export interface ScenarioAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface ScenarioTurn {
  user: string;
}

export interface ScenarioRuntimeConfig {
  required_profiles?: string[];
  tool_mocks?: RuntimeToolMocks;
}

export interface ScenarioExpectations {
  visitedNodes?: string[];
  finalNodeId?: string;
  variables?: Record<string, string>;
  actions?: Array<{ type: string; payload?: Record<string, unknown> }>;
  forbiddenMessages?: string[];
}

export interface JourneyScenario {
  id: string;
  name: string;
  turns: ScenarioTurn[];
  runtime?: ScenarioRuntimeConfig;
  expect?: ScenarioExpectations;
}

export const journeyScenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().default("").optional(),
  journey_id: z.string().min(1).optional(),
  status: z.enum(["active", "draft", "archived"]).default("active").optional(),
  category: z.enum(["behavior", "policy", "tone", "technical"]).default("behavior").optional(),
  turns: z.array(z.object({ user: z.string().min(1) })).min(1),
  runtime: z.object({
    required_profiles: z.array(z.string().min(1)).optional(),
    tool_mocks: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  expectations: z.object({
    visitedNodes: z.array(z.string()).optional(),
    finalNodeId: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
    actions: z.array(z.object({
      type: z.string().min(1),
      payload: z.record(z.string(), z.unknown()).optional(),
    })).optional(),
    forbiddenMessages: z.array(z.string()).optional(),
  }).optional(),
  tags: z.array(z.string()).default([]).optional(),
});

export interface ScenarioRunResult {
  scenarioId: string;
  scenarioName: string;
  outcome: "success" | "partial" | "failure";
  metrics: {
    resolution: number;
    empathy: number;
    compliance: number;
    accuracy: number;
  };
  issues: string[];
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  visitedNodes: string[];
  variables: Record<string, string>;
  actions: ScenarioAction[];
  validationIssues: JourneyValidationIssue[];
}

function sampleValueForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("amount")) return "100";
  if (lower.includes("ssn")) return "1234";
  if (lower.includes("dob") || lower.includes("date")) return "01/01/1990";
  if (lower.includes("email")) return "customer@example.com";
  if (lower.includes("yes") || lower.includes("confirm") || lower.includes("accepted")) return "yes";
  if (lower.includes("reason")) return "defective";
  if (lower.includes("order")) return "12345";
  return "yes";
}

export function createSmokeScenario(journey: Pick<JourneyLike, "id" | "name" | "nodes">): JourneyScenario {
  const inputNodes = journey.nodes.filter((node): node is { type: string; data: Record<string, unknown>; label: string } => {
    return Boolean(
      node &&
      typeof node === "object" &&
      "type" in node &&
      "data" in node &&
      (node as { type?: unknown }).type === "input"
    );
  });
  return {
    id: `${journey.id || "journey"}:smoke`,
    name: `${journey.name || "Journey"} Smoke Test`,
    turns: inputNodes.map((node) => ({
      user: sampleValueForVariable(String(node.data.variable || node.label || "input")),
    })),
  };
}

function expectationIssues(result: Omit<ScenarioRunResult, "outcome" | "metrics" | "issues">, expect?: ScenarioExpectations): string[] {
  if (!expect) return [];
  const issues: string[] = [];

  for (const nodeId of expect.visitedNodes || []) {
    if (!result.visitedNodes.includes(nodeId)) {
      issues.push(`Expected node "${nodeId}" was not visited`);
    }
  }

  if (expect.finalNodeId && result.visitedNodes.at(-1) !== expect.finalNodeId) {
    issues.push(`Expected final node "${expect.finalNodeId}" but reached "${result.visitedNodes.at(-1) || "none"}"`);
  }

  for (const [name, value] of Object.entries(expect.variables || {})) {
    if (result.variables[name] !== value) {
      issues.push(`Expected variable "${name}" to equal "${value}" but got "${result.variables[name] ?? ""}"`);
    }
  }

  for (const expectedAction of expect.actions || []) {
    const found = result.actions.some((action) => {
      if (action.type !== expectedAction.type) return false;
      if (!expectedAction.payload) return true;
      return isSubset(expectedAction.payload, action.payload);
    });
    if (!found) issues.push(`Expected action "${expectedAction.type}" was not emitted`);
  }

  for (const forbidden of expect.forbiddenMessages || []) {
    const lower = forbidden.toLowerCase();
    if (result.messages.some((message) => message.text.toLowerCase().includes(lower))) {
      issues.push(`Forbidden message text appeared: "${forbidden}"`);
    }
  }

  return issues;
}

function isSubset(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true;
  if (expected === null || expected === undefined) return expected === actual;

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length > actual.length) return false;
    return expected.every((value, index) => isSubset(value, actual[index]));
  }

  if (typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    return Object.entries(expected as Record<string, unknown>)
      .every(([key, value]) => isSubset(value, (actual as Record<string, unknown>)[key]));
  }

  return false;
}

function scoreFromIssues(issueCount: number, base: number): number {
  return Math.max(0, base - issueCount * 20);
}

function toRuntimeJourney(compiled: ReturnType<typeof compileJourney>, journey: JourneyLike): DialogJourney {
  return {
    id: compiled.normalized.id || journey.id,
    name: compiled.normalized.name,
    description: compiled.normalized.description,
    status: compiled.normalized.status,
    nodes: compiled.normalized.nodes,
    edges: compiled.normalized.edges,
    variables: compiled.normalized.variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function finalizeScenarioResult(
  baseResult: Omit<ScenarioRunResult, "outcome" | "metrics" | "issues">,
  done: boolean,
  expect?: ScenarioExpectations
): ScenarioRunResult {
  const issues = expectationIssues(baseResult, expect);
  if (!done && baseResult.actions.some((action) => action.type === "wait_input")) {
    issues.push("Scenario ended while the journey was still waiting for user input");
  }
  if (!done && !baseResult.actions.some((action) => action.type === "wait_input")) {
    issues.push("Journey did not reach a terminal state");
  }

  const errorCount = baseResult.validationIssues.filter((i) => i.severity === "error").length;
  const warningCount = baseResult.validationIssues.filter((i) => i.severity === "warning").length;
  const issueCount = issues.length + errorCount + Math.ceil(warningCount / 2);

  return {
    ...baseResult,
    outcome: issueCount === 0 ? "success" : issueCount <= 2 ? "partial" : "failure",
    metrics: {
      resolution: done ? scoreFromIssues(issueCount, 100) : scoreFromIssues(issueCount, 75),
      empathy: 80,
      compliance: scoreFromIssues(errorCount + warningCount, 100),
      accuracy: scoreFromIssues(issues.length, 100),
    },
    issues,
  };
}

function failedScenarioResult(
  scenario: JourneyScenario,
  issues: string[],
  validationIssues: JourneyValidationIssue[] = []
): ScenarioRunResult {
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    outcome: "failure",
    metrics: { resolution: 0, empathy: 0, compliance: 0, accuracy: 0 },
    issues,
    messages: [],
    visitedNodes: [],
    variables: {},
    actions: [],
    validationIssues,
  };
}

export function runDeterministicScenario(journey: JourneyLike, scenario: JourneyScenario): ScenarioRunResult {
  const compiled = compileJourney(journey);
  const validationIssues = [...compiled.errors, ...compiled.warnings];
  const messages: ScenarioRunResult["messages"] = [];
  const actions: DialogAction[] = [];

  if (!compiled.valid) {
    return failedScenarioResult(scenario, compiled.errors.map((i) => i.message), validationIssues);
  }

  const runtimeJourney = toRuntimeJourney(compiled, journey);
  const engine = new DialogEngine(runtimeJourney);
  const state = DialogEngine.createState(`sim-${scenario.id}`, runtimeJourney.id);
  const start = engine.start(state);
  messages.push(...start.messages.map((text) => ({ role: "assistant" as const, text })));
  actions.push(...start.actions);

  let done = start.done;
  for (const turn of scenario.turns) {
    if (done) break;
    messages.push({ role: "user", text: turn.user });
    state.context.lastMessage = turn.user;
    const result = engine.handleInput(state, turn.user);
    messages.push(...result.messages.map((text) => ({ role: "assistant" as const, text })));
    actions.push(...result.actions);
    done = result.done;
  }

  const baseResult = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    messages,
    visitedNodes: state.history.map((h) => h.nodeId).concat(state.currentNodeId ? [state.currentNodeId] : []),
    variables: state.variables,
    actions,
    validationIssues,
  };

  return finalizeScenarioResult(baseResult, done, scenario.expect);
}

export async function runHybridScenario(
  journey: JourneyLike,
  scenario: JourneyScenario,
  runtime: TenantRuntime
): Promise<ScenarioRunResult> {
  const compiled = compileJourney(journey);
  const validationIssues = [...compiled.errors, ...compiled.warnings];
  const messages: ScenarioRunResult["messages"] = [];
  const actions: ScenarioAction[] = [];

  if (!compiled.valid) {
    return failedScenarioResult(scenario, compiled.errors.map((i) => i.message), validationIssues);
  }

  const requiredProfiles = scenario.runtime?.required_profiles || [];
  const missingProfiles = requiredProfiles.filter((profileId) => !findRuntimeProfile(runtime, profileId));
  if (missingProfiles.length > 0) {
    return failedScenarioResult(
      scenario,
      missingProfiles.map((profile) => `Required runtime profile "${profile}" was not found`),
      validationIssues
    );
  }

  const runtimeJourney = toRuntimeJourney(compiled, journey);
  const runtimeWithMocks = scenario.runtime?.tool_mocks
    ? withRuntimeOverrides(runtime, { toolMocks: scenario.runtime.tool_mocks })
    : runtime;
  const engine = new NodeLevelHybridExecutor(runtimeJourney, runtimeWithMocks);
  const state = DialogEngine.createState(`sim-${scenario.id}`, runtimeJourney.id);
  const start = await engine.start(state);
  messages.push(...start.messages.map((text) => ({ role: "assistant" as const, text })));
  actions.push(...start.actions);

  let done = start.done;
  for (const turn of scenario.turns) {
    if (done) break;
    messages.push({ role: "user", text: turn.user });
    state.context.lastMessage = turn.user;
    const result = await engine.handleInput(state, turn.user);
    messages.push(...result.messages.map((text) => ({ role: "assistant" as const, text })));
    actions.push(...result.actions);
    done = result.done;
  }

  const baseResult = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    messages,
    visitedNodes: state.history.map((h) => h.nodeId).concat(state.currentNodeId ? [state.currentNodeId] : []),
    variables: state.variables,
    actions,
    validationIssues,
  };

  return finalizeScenarioResult(baseResult, done, scenario.expect);
}

export async function runJourneyScenario(
  journey: JourneyLike,
  scenario: JourneyScenario,
  runtime?: TenantRuntime
): Promise<ScenarioRunResult> {
  if (journey.execution_mode === "hybrid") {
    if (!runtime) {
      return failedScenarioResult(scenario, ["Hybrid scenario requires tenant runtime profiles"]);
    }
    return runHybridScenario(journey, scenario, runtime);
  }

  if (!journey.execution_mode || journey.execution_mode === "deterministic") {
    return runDeterministicScenario(journey, scenario);
  }

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    outcome: "partial",
    metrics: { resolution: 50, empathy: 0, compliance: 50, accuracy: 50 },
    issues: [`${journey.execution_mode} journeys require a provider-backed LLM scenario runner`],
    messages: [],
    visitedNodes: [],
    variables: {},
    actions: [],
    validationIssues: [],
  };
}
