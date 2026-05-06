// ConfirmSkill — deterministic confirmation gate prior to side-effectful actions.

import type {
  Skill,
  SkillContext,
  ConfirmInput,
  ConfirmOutput,
} from "../agents/types";

export const confirmSkill: Skill<ConfirmInput, ConfirmOutput> = {
  name: "confirm",
  async run(input: ConfirmInput, _ctx: SkillContext): Promise<ConfirmOutput> {
    const prompt = `Just to confirm, you'd like me to ${input.summary}. Reply 'yes' to proceed or 'no' to cancel.`;
    const pendingActionId = crypto.randomUUID();
    return { prompt, pendingActionId };
  },
};
