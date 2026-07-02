import type {
  Policy,
  PolicyDecision,
  PolicyCheckSlotInput,
  PolicyCheckToolInput,
  PolicyCheckResponseInput,
} from "./types";

const allow = (): PolicyDecision => ({ decision: "allow" });
const deny = (reason: string): PolicyDecision => ({ decision: "deny", reason });
const requireApproval = (reason: string, approver?: string): PolicyDecision => ({
  decision: "require_approval",
  reason,
  approver,
});

export const refundAmountLimit: Policy = {
  id: "refund_amount_limit",
  description: "Refunds over $500 require manager approval.",
  appliesTo: "tool",
  evaluate: (input: PolicyCheckToolInput) => {
    if (input.tool !== "process_refund") return allow();
    const amount = Number(input.params?.amount);
    if (!Number.isNaN(amount) && amount > 500) {
      return requireApproval("Refund over $500 requires manager approval", "manager");
    }
    return allow();
  },
};

export const refundRequiresOrderId: Policy = {
  id: "refund_requires_order_id",
  description: "Refunds must reference an order ID.",
  appliesTo: "tool",
  evaluate: (input: PolicyCheckToolInput) => {
    if (input.tool !== "process_refund") return allow();
    if (!input.params?.order_id) return deny("Order ID required before refund");
    return allow();
  },
};

export const kycRequiresDob: Policy = {
  id: "kyc_requires_dob",
  description: "Identity verification requires date of birth.",
  appliesTo: "tool",
  evaluate: (input: PolicyCheckToolInput) => {
    if (input.tool !== "verify_identity") return allow();
    if (!input.params?.dob) return deny("Date of birth required for KYC");
    return allow();
  },
};

export const slotTypeCheck: Policy = {
  id: "slot_type_check",
  description: "Slot values must not be empty strings.",
  appliesTo: "slot",
  evaluate: (input: PolicyCheckSlotInput) => {
    if (typeof input.value === "string" && input.value.trim() === "") {
      return deny(`Slot '${input.slotName}' cannot be empty`);
    }
    return allow();
  },
};

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;
const CC_PATTERN = /\b\d{13,19}\b/;

export const piiInResponse: Policy = {
  id: "pii_in_response",
  description: "Block responses containing SSN or credit-card-like numbers.",
  appliesTo: "response",
  evaluate: (input: PolicyCheckResponseInput) => {
    if (SSN_PATTERN.test(input.content) || CC_PATTERN.test(input.content)) {
      return deny("Response contained PII");
    }
    return allow();
  },
};

export const offTopicResponse: Policy = {
  id: "off_topic_response",
  description: "LLM-based off-topic detection for responses.",
  appliesTo: "response",
  evaluate: async (input: PolicyCheckResponseInput) => {
    // Quick heuristic first (no LLM call) — check for obviously off-topic patterns
    const offTopicPatterns = [
      /\b(bitcoin|crypto|nft|stocks|forex|gambling|casino|lottery)\b/i,
      /\b(politics|election|democrat|republican|trump|biden)\b/i,
      /\b(prescription|medication|diagnos|medical advice)\b/i,
    ];
    for (const pattern of offTopicPatterns) {
      if (pattern.test(input.content)) {
        return deny("Response contains off-topic content");
      }
    }
    // Content passes heuristic — allow (LLM classification is done in supervisor)
    return allow();
  },
};

// Per-conversation rate limiting state (ephemeral, in-memory)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

export const conversationRateLimit: Policy = {
  id: "conversation_rate_limit",
  description: "Max 50 tool calls per conversation window (10 min).",
  appliesTo: "tool",
  evaluate: (input: PolicyCheckToolInput) => {
    const key = input.variables?.conversationId ?? "global";
    const now = Date.now();
    const window = 10 * 60 * 1000; // 10 min
    const maxCalls = 50;

    const state = rateLimitStore.get(key) ?? { count: 0, windowStart: now };
    if (now - state.windowStart > window) {
      // Reset window
      rateLimitStore.set(key, { count: 1, windowStart: now });
      return allow();
    }
    state.count++;
    rateLimitStore.set(key, state);
    if (state.count > maxCalls) {
      return deny(`Rate limit exceeded: ${state.count} tool calls in 10 minutes (max ${maxCalls})`);
    }
    return allow();
  },
};

export const refundActionLimit: Policy = {
  id: "refund_action_limit",
  description: "Max 2 refund operations per conversation.",
  appliesTo: "tool",
  evaluate: (input: PolicyCheckToolInput) => {
    if (input.tool !== "process_refund") return allow();
    const key = `refund:${input.variables?.conversationId ?? "global"}`;
    const now = Date.now();
    const state = rateLimitStore.get(key) ?? { count: 0, windowStart: now };
    state.count++;
    rateLimitStore.set(key, state);
    if (state.count > 2) {
      return deny("Maximum 2 refund operations per conversation");
    }
    return allow();
  },
};

export const allRules: Policy[] = [
  refundAmountLimit,
  refundRequiresOrderId,
  kycRequiresDob,
  slotTypeCheck,
  piiInResponse,
  offTopicResponse,
  conversationRateLimit,
  refundActionLimit,
];
