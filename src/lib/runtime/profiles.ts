import { z } from "zod";

export const runtimePolicyRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  effect: z.enum(["allow", "deny", "require_approval", "escalate"]).default("deny"),
  when: z.object({
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists"]),
    var: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }),
  reason: z.string().optional(),
});

export const runtimeProfileSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["router", "specialist", "policy", "guardrail"]).default("specialist"),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  description: z.string().default("").optional(),
  allowed_journeys: z.array(z.string()).default([]).optional(),
  allowed_tools: z.array(z.string()).default([]).optional(),
  allowed_slots: z.array(z.string()).default([]).optional(),
  guardrails: z.array(z.string()).default([]).optional(),
  policies: z.array(runtimePolicyRuleSchema).default([]).optional(),
  config: z.record(z.string(), z.unknown()).default({}).optional(),
});

export type RuntimePolicyRule = z.infer<typeof runtimePolicyRuleSchema>;
export type RuntimeProfileDefinition = z.infer<typeof runtimeProfileSchema>;

export interface RuntimeProfile extends RuntimeProfileDefinition {
  id: string;
  tenant_id?: string;
}

export interface RuntimeDecision {
  allowed: boolean;
  effect: "allow" | "deny" | "require_approval" | "escalate";
  reason?: string;
  policyId?: string;
}

export function canUseJourney(profile: Pick<RuntimeProfile, "allowed_journeys">, journeyId: string): boolean {
  const allowed = profile.allowed_journeys || [];
  return allowed.length === 0 || allowed.includes(journeyId);
}

export function canUseTool(profile: Pick<RuntimeProfile, "allowed_tools">, toolName: string): boolean {
  const allowed = profile.allowed_tools || [];
  return allowed.length === 0 || allowed.includes(toolName);
}

export function canWriteSlot(profile: Pick<RuntimeProfile, "allowed_slots">, slotName: string): boolean {
  const allowed = profile.allowed_slots || [];
  return allowed.length === 0 || allowed.includes(slotName);
}

function compareValue(rule: RuntimePolicyRule, variables: Record<string, unknown>): boolean {
  const actual = variables[rule.when.var];
  const expected = rule.when.value;

  switch (rule.when.op) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "eq":
      return String(actual ?? "") === String(expected ?? "");
    case "neq":
      return String(actual ?? "") !== String(expected ?? "");
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
  }
}

export function evaluateProfilePolicies(
  profile: Pick<RuntimeProfile, "policies">,
  variables: Record<string, unknown>
): RuntimeDecision {
  for (const policy of profile.policies || []) {
    if (!compareValue(policy, variables)) continue;
    return {
      allowed: policy.effect === "allow",
      effect: policy.effect,
      reason: policy.reason || policy.description,
      policyId: policy.id,
    };
  }

  return { allowed: true, effect: "allow" };
}

export function evaluateRuntimeProfile(
  profile: RuntimeProfile,
  request: {
    journeyId?: string;
    toolName?: string;
    slotWrites?: string[];
    variables?: Record<string, unknown>;
  }
): RuntimeDecision {
  if (profile.status !== "active") {
    return { allowed: false, effect: "deny", reason: "Runtime profile is not active" };
  }

  if (request.journeyId && !canUseJourney(profile, request.journeyId)) {
    return { allowed: false, effect: "deny", reason: `Profile cannot use journey ${request.journeyId}` };
  }

  if (request.toolName && !canUseTool(profile, request.toolName)) {
    return { allowed: false, effect: "deny", reason: `Profile cannot use tool ${request.toolName}` };
  }

  for (const slot of request.slotWrites || []) {
    if (!canWriteSlot(profile, slot)) {
      return { allowed: false, effect: "deny", reason: `Profile cannot write slot ${slot}` };
    }
  }

  return evaluateProfilePolicies(profile, request.variables || {});
}

