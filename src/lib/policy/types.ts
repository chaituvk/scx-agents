export type {
  PolicyDecision,
  PolicyCheckSlotInput,
  PolicyCheckToolInput,
  PolicyCheckResponseInput,
} from "../agents/types";

import type { PolicyDecision } from "../agents/types";

export interface Policy {
  id: string;
  description: string;
  appliesTo: "slot" | "tool" | "response";
  evaluate(input: any): PolicyDecision | Promise<PolicyDecision>;
}
