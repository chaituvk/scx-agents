import { routingRuleRepo, type RuleCondition } from "../repositories/routing-rule";

export interface RoutingContext {
  message: string;
  channel: string;
  customerId?: string;
  customerLanguage?: string;
  customerTags?: string[];
  conversationCount?: number;
  hourOfDay?: number;
}

export interface RoutingAction {
  type: string;
  payload: Record<string, unknown>;
  ruleName: string;
  ruleId: string;
}

export function evaluateCondition(condition: RuleCondition, ctx: RoutingContext): boolean {
  const { field, operator, value } = condition;

  let fieldValue: string | number | string[] | undefined;
  switch (field) {
    case "message":
      fieldValue = ctx.message;
      break;
    case "channel":
      fieldValue = ctx.channel;
      break;
    case "customer_language":
      fieldValue = ctx.customerLanguage;
      break;
    case "customer_tag":
      fieldValue = ctx.customerTags;
      break;
    case "conversation_count":
      fieldValue = ctx.conversationCount;
      break;
    case "hour_of_day":
      fieldValue = ctx.hourOfDay ?? new Date().getUTCHours();
      break;
    default:
      return false;
  }

  if (fieldValue === undefined) return false;

  switch (operator) {
    case "contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;

    case "not_contains":
      if (typeof fieldValue === "string" && typeof value === "string") {
        return !fieldValue.toLowerCase().includes(value.toLowerCase());
      }
      return false;

    case "equals":
      if (typeof fieldValue === "string" || typeof fieldValue === "number") {
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      }
      return false;

    case "not_equals":
      if (typeof fieldValue === "string" || typeof fieldValue === "number") {
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      }
      return false;

    case "greater_than":
      if (typeof fieldValue === "number" && typeof value === "number") {
        return fieldValue > value;
      }
      return false;

    case "less_than":
      if (typeof fieldValue === "number" && typeof value === "number") {
        return fieldValue < value;
      }
      return false;

    case "in": {
      const arr = Array.isArray(value) ? value : [value];
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => arr.includes(v));
      }
      if (typeof fieldValue === "string" || typeof fieldValue === "number") {
        return arr.includes(String(fieldValue));
      }
      return false;
    }

    case "not_in": {
      const arr = Array.isArray(value) ? value : [value];
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => arr.includes(v));
      }
      if (typeof fieldValue === "string" || typeof fieldValue === "number") {
        return !arr.includes(String(fieldValue));
      }
      return false;
    }

    default:
      return false;
  }
}

export async function applyRoutingRules(
  tenantId: string,
  ctx: RoutingContext,
): Promise<RoutingAction | null> {
  const rules = await routingRuleRepo.findActive(tenantId);

  for (const rule of rules) {
    const conditions = rule.conditions;
    if (!conditions.length) continue;

    let matched: boolean;
    if (rule.condition_logic === "all") {
      matched = conditions.every((c) => evaluateCondition(c, ctx));
    } else {
      matched = conditions.some((c) => evaluateCondition(c, ctx));
    }

    if (matched) {
      return {
        type: rule.action_type,
        payload: rule.action_payload,
        ruleName: rule.name,
        ruleId: rule.id,
      };
    }
  }

  return null;
}
