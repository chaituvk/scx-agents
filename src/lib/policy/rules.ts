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
  description: "Off-topic detection (stub).",
  appliesTo: "response",
  evaluate: (_input: PolicyCheckResponseInput) => allow(),
};

export const allRules: Policy[] = [
  refundAmountLimit,
  refundRequiresOrderId,
  kycRequiresDob,
  slotTypeCheck,
  piiInResponse,
  offTopicResponse,
];
