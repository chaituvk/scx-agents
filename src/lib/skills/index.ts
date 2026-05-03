// Skill registry — central lookup for built-in skill primitives.

import type { Skill, SkillName } from "../agents/types";
import { triageSkill } from "./triage";
import { retrieveSkill } from "./retrieve";
import { extractSlotSkill } from "./extract-slot";
import { respondSkill } from "./respond";
import { confirmSkill } from "./confirm";
import { actSkill } from "./act";
import { summarizeSkill } from "./summarize";

export const skills: Record<SkillName, Skill<any, any>> = {
  triage: triageSkill,
  retrieve: retrieveSkill,
  extract_slot: extractSlotSkill,
  respond: respondSkill,
  confirm: confirmSkill,
  act: actSkill,
  summarize: summarizeSkill,
};

export function getSkill<I = unknown, O = unknown>(name: SkillName): Skill<I, O> {
  const s = skills[name];
  if (!s) throw new Error(`Skill '${name}' not found`);
  return s as Skill<I, O>;
}

export {
  triageSkill,
  retrieveSkill,
  extractSlotSkill,
  respondSkill,
  confirmSkill,
  actSkill,
  summarizeSkill,
};
