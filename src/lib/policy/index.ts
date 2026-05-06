import { PolicyChecker } from "./checker";
import { allRules } from "./rules";
import type { Policy } from "./types";

export { PolicyChecker } from "./checker";
export type {
  Policy,
  PolicyDecision,
  PolicyCheckSlotInput,
  PolicyCheckToolInput,
  PolicyCheckResponseInput,
} from "./types";

export const policyChecker = new PolicyChecker(allRules);

export function registerPolicy(policy: Policy): void {
  policyChecker.register(policy);
}
