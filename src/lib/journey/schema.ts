import { z } from "zod";

export const JOURNEY_NODE_TYPES = [
  "start",
  "intent",
  "message",
  "input",
  "condition",
  "action",
  "api",
  "llm_extract",
  "llm_draft",
  "policy_check",
  "tool_call",
  "transfer",
  "end",
] as const;

export const EXECUTION_MODES = ["deterministic", "llm", "hybrid"] as const;

export type JourneyNodeType = (typeof JOURNEY_NODE_TYPES)[number];
export type JourneyExecutionMode = (typeof EXECUTION_MODES)[number];

export type ConditionExpression =
  | { op: "always" }
  | { op: "empty" | "not_empty"; var: string }
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "matches"; var: string; value: string | number | boolean }
  | { op: "and" | "or"; conditions: ConditionExpression[] }
  | { op: "not"; condition: ConditionExpression };

export interface JourneyValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface JourneyCompileResult {
  valid: boolean;
  errors: JourneyValidationIssue[];
  warnings: JourneyValidationIssue[];
  normalized: JourneyDefinition;
}

const conditionExpressionSchema: z.ZodType<ConditionExpression> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("always") }),
    z.object({ op: z.enum(["empty", "not_empty"]), var: z.string().min(1) }),
    z.object({
      op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "matches"]),
      var: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({ op: z.enum(["and", "or"]), conditions: z.array(conditionExpressionSchema).min(1) }),
    z.object({ op: z.literal("not"), condition: conditionExpressionSchema }),
  ])
);

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(JOURNEY_NODE_TYPES),
  label: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0, y: 0 }),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  condition: z.union([z.string(), conditionExpressionSchema]).optional(),
});

export const variableSpecSchema = z.object({
  type: z.enum(["string", "number", "boolean", "date", "object", "array"]).default("string"),
  required: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  regulated: z.boolean().default(false),
  description: z.string().optional(),
  source: z.enum(["user", "system", "tool", "llm"]).optional(),
});

export const journeyDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).default("Untitled Journey"),
  description: z.string().default(""),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  execution_mode: z.enum(EXECUTION_MODES).default("deterministic"),
  version: z.string().default("1.0.0"),
  nodes: z.array(flowNodeSchema).default([]),
  edges: z.array(flowEdgeSchema).default([]),
  variables: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).default({}),
  policies: z.array(z.record(z.string(), z.unknown())).default([]).optional(),
  guardrails: z.array(z.string()).default([]).optional(),
  skills: z.array(z.string()).default([]).optional(),
});

export type JourneyDefinition = z.infer<typeof journeyDefinitionSchema>;
export type FlowNodeDefinition = z.infer<typeof flowNodeSchema>;
export type FlowEdgeDefinition = z.infer<typeof flowEdgeSchema>;

function issue(
  severity: JourneyValidationIssue["severity"],
  code: string,
  message: string,
  meta: Pick<JourneyValidationIssue, "nodeId" | "edgeId"> = {}
): JourneyValidationIssue {
  return { severity, code, message, ...meta };
}

export function normalizeVariables(variables: unknown, nodes: FlowNodeDefinition[] = []): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  if (Array.isArray(variables)) {
    for (const name of variables) {
      if (typeof name === "string" && name.trim()) normalized[name] = "";
    }
  } else if (variables && typeof variables === "object") {
    Object.assign(normalized, variables);
  }

  for (const node of nodes) {
    const variable = node.data.variable;
    if (typeof variable === "string" && variable.trim() && normalized[variable] === undefined) {
      normalized[variable] = "";
    }
    const params = node.data.params;
    if (Array.isArray(params)) {
      for (const param of params) {
        if (typeof param === "string" && param.trim() && normalized[param] === undefined) {
          normalized[param] = "";
        }
      }
    }
  }

  return normalized;
}

export function normalizeJourneyInput(input: unknown): JourneyDefinition {
  const parsed = journeyDefinitionSchema.parse(input);
  return {
    ...parsed,
    variables: normalizeVariables(parsed.variables, parsed.nodes),
  };
}

export function parseLegacyCondition(
  condition: string,
  variable?: string
): ConditionExpression | null {
  const trimmed = condition.trim();
  if (!trimmed) return null;

  const [operator, ...rest] = trimmed.split(/\s+/);
  const operand = rest.join(" ");

  if (operator === "always") return { op: "always" };
  if ((operator === "empty" || operator === "not_empty") && variable) return { op: operator, var: variable };
  if (!variable || !["eq", "neq", "gt", "gte", "lt", "lte", "contains", "matches"].includes(operator)) {
    return null;
  }

  return {
    op: operator as Extract<ConditionExpression, { value: unknown }>["op"],
    var: variable,
    value: operand,
  };
}

export function conditionVariables(condition: FlowEdgeDefinition["condition"]): string[] {
  if (!condition || typeof condition === "string") return [];
  switch (condition.op) {
    case "always":
      return [];
    case "empty":
    case "not_empty":
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "contains":
    case "matches":
      return [condition.var];
    case "and":
    case "or":
      return condition.conditions.flatMap(conditionVariables);
    case "not":
      return conditionVariables(condition.condition);
  }
}

export function compileJourney(input: unknown): JourneyCompileResult {
  const issues: JourneyValidationIssue[] = [];
  let normalized: JourneyDefinition;

  try {
    normalized = normalizeJourneyInput(input);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join(".") || "journey"}: ${i.message}`).join("; ")
      : "Journey shape is invalid";
    const fallback = journeyDefinitionSchema.parse({});
    return {
      valid: false,
      errors: [issue("error", "invalid_schema", message)],
      warnings: [],
      normalized: { ...fallback, variables: {} },
    };
  }

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const variableNames = new Set(Object.keys(normalized.variables as Record<string, unknown>));

  for (const node of normalized.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(issue("error", "duplicate_node_id", `Duplicate node id "${node.id}".`, { nodeId: node.id }));
    }
    nodeIds.add(node.id);

    const variable = node.data.variable;
    if (typeof variable === "string" && variable.trim()) variableNames.add(variable);

    if (node.type === "message" && typeof node.data.text !== "string") {
      issues.push(issue("error", "message_text_required", "Message nodes require data.text.", { nodeId: node.id }));
    }
    if (node.type === "input") {
      if (typeof node.data.prompt !== "string") {
        issues.push(issue("error", "input_prompt_required", "Input nodes require data.prompt.", { nodeId: node.id }));
      }
      if (typeof node.data.variable !== "string" || !node.data.variable.trim()) {
        issues.push(issue("error", "input_variable_required", "Input nodes require data.variable.", { nodeId: node.id }));
      }
    }
    if (node.type === "condition" && (typeof node.data.variable !== "string" || !node.data.variable.trim())) {
      issues.push(issue("error", "condition_variable_required", "Condition nodes require data.variable.", { nodeId: node.id }));
    }
    if (node.type === "api" && typeof node.data.endpoint !== "string") {
      issues.push(issue("error", "api_endpoint_required", "API nodes require data.endpoint.", { nodeId: node.id }));
    }
    if (["llm_extract", "llm_draft", "policy_check", "tool_call"].includes(node.type) && typeof node.data.profile !== "string") {
      issues.push(issue("error", "runtime_profile_required", `${node.type} nodes require data.profile.`, { nodeId: node.id }));
    }
    if (node.type === "tool_call" && typeof node.data.tool !== "string") {
      issues.push(issue("error", "tool_name_required", "Tool call nodes require data.tool.", { nodeId: node.id }));
    }
    if (node.type === "transfer" && typeof node.data.reason !== "string") {
      issues.push(issue("warning", "transfer_reason_recommended", "Transfer nodes should include an auditable reason.", { nodeId: node.id }));
    }
  }

  const startNodes = normalized.nodes.filter((n) => n.type === "start");
  const endNodes = normalized.nodes.filter((n) => n.type === "end");
  if (startNodes.length !== 1) {
    issues.push(issue("error", "one_start_required", `Journey must have exactly one start node; found ${startNodes.length}.`));
  }
  if (endNodes.length < 1 && normalized.execution_mode !== "llm") {
    issues.push(issue("error", "end_required", "Deterministic and hybrid journeys require at least one end node."));
  }

  for (const edge of normalized.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push(issue("error", "duplicate_edge_id", `Duplicate edge id "${edge.id}".`, { edgeId: edge.id }));
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      issues.push(issue("error", "missing_edge_source", `Edge source "${edge.source}" does not exist.`, { edgeId: edge.id }));
    }
    if (!nodeIds.has(edge.target)) {
      issues.push(issue("error", "missing_edge_target", `Edge target "${edge.target}" does not exist.`, { edgeId: edge.id }));
    }
  }

  if (startNodes[0]) {
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      for (const edge of normalized.edges.filter((e) => e.source === nodeId)) {
        queue.push(edge.target);
      }
    }
    for (const node of normalized.nodes) {
      if (!reachable.has(node.id)) {
        issues.push(issue("warning", "unreachable_node", `Node "${node.label}" is not reachable from start.`, { nodeId: node.id }));
      }
    }
  }

  for (const node of normalized.nodes) {
    const outgoing = normalized.edges.filter((e) => e.source === node.id);
    if (node.type === "condition" && outgoing.length > 1) {
      const conditional = outgoing.filter((e) => Boolean(e.condition));
      const defaults = outgoing.filter((e) => !e.condition);
      if (conditional.length === 0) {
        issues.push(issue("error", "condition_edges_required", "Condition nodes with multiple branches need edge conditions.", { nodeId: node.id }));
      }
      if (defaults.length === 0) {
        issues.push(issue("warning", "default_branch_recommended", "Condition nodes should include a default/fallback branch.", { nodeId: node.id }));
      }
    }
    if (node.type === "end" && outgoing.length > 0) {
      issues.push(issue("warning", "end_has_outgoing", "End nodes should not have outgoing edges.", { nodeId: node.id }));
    }
  }

  normalized.variables = Object.fromEntries(Array.from(variableNames).map((name) => [name, (normalized.variables as Record<string, unknown>)[name] ?? ""]));

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}
