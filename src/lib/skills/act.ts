// ActSkill — executes a registered tool and emits a tool_call audit event.

import { executeTool } from "../tools/registry";
import type {
  Skill,
  SkillContext,
  ActInput,
  ActOutput,
} from "../agents/types";

export const actSkill: Skill<ActInput, ActOutput> = {
  name: "act",
  async run(input: ActInput, ctx: SkillContext): Promise<ActOutput> {
    let result: unknown;
    let ok = true;
    let errorMessage: string | undefined;
    try {
      result = await executeTool(input.tool, input.params);
    } catch (err) {
      ok = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      result = { error: errorMessage };
    }
    await ctx.audit.emit("tool_call", {
      tool: input.tool,
      params: input.params,
      ok,
      result,
      error: errorMessage,
    });
    return { result, ok };
  },
};
