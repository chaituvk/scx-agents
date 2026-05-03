// ExtractSlotSkill — pulls structured slot values from a user message.

import { callModel } from "../model-router";
import type {
  Skill,
  SkillContext,
  ExtractSlotInput,
  ExtractSlotOutput,
} from "../agents/types";

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export const extractSlotSkill: Skill<ExtractSlotInput, ExtractSlotOutput> = {
  name: "extract_slot",
  async run(input: ExtractSlotInput, _ctx: SkillContext): Promise<ExtractSlotOutput> {
    const schemaLines = Object.entries(input.slotSchema).map(
      ([name, def]) => `- ${name} (${def.type}): ${def.description}`
    );
    const sys = `Extract structured slots from the user message based on the schema. Return JSON only.
Schema:
${schemaLines.join("\n")}
Return a JSON object: {"slots": { ... }}. Skip slots whose value is not present — do not hallucinate.`;
    const res = await callModel(
      [
        { role: "system", content: sys },
        { role: "user", content: input.message },
      ],
      { tier: "reasoning", jsonMode: true }
    );
    const parsed = parseJson(res.content);
    const rawSlots = (parsed?.slots ?? {}) as Record<string, unknown>;
    const slots: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(rawSlots)) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        slots[k] = v;
      }
    }
    return { slots };
  },
};
