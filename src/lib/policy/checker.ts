import type {
  Policy,
  PolicyDecision,
  PolicyCheckSlotInput,
  PolicyCheckToolInput,
  PolicyCheckResponseInput,
} from "./types";

export class PolicyChecker {
  private policies: Policy[];

  constructor(policies: Policy[]) {
    this.policies = [...policies];
  }

  register(policy: Policy): void {
    this.policies.push(policy);
  }

  async validateSlotWrite(input: PolicyCheckSlotInput): Promise<PolicyDecision> {
    return this.run("slot", input);
  }

  async validateToolCall(input: PolicyCheckToolInput): Promise<PolicyDecision> {
    return this.run("tool", input);
  }

  async validateResponse(input: PolicyCheckResponseInput): Promise<PolicyDecision> {
    return this.run("response", input);
  }

  private async run(
    kind: Policy["appliesTo"],
    input: PolicyCheckSlotInput | PolicyCheckToolInput | PolicyCheckResponseInput
  ): Promise<PolicyDecision> {
    const matching = this.policies.filter((p) => p.appliesTo === kind);
    let pendingApproval: PolicyDecision | null = null;

    for (const policy of matching) {
      const result = await policy.evaluate(input);
      if (result.decision === "deny") return result;
      if (result.decision === "require_approval" && !pendingApproval) {
        pendingApproval = result;
      }
    }

    return pendingApproval ?? { decision: "allow" };
  }
}
