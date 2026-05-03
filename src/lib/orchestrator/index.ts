// Orchestrator — owns the turn loop. Loads memory, triages, dispatches to a
// sub-agent, runs the supervisor, audits each step, and returns the result.

import { memoryService } from "../memory";
import { triageSkill } from "../skills";
import { selectSubAgent } from "../agents/registry";
import { supervisorAgent } from "../agents/supervisor";
import { makeAuditEmitter } from "../audit";
import type {
  OrchestratorTurnInput,
  OrchestratorTurnOutput,
  SkillContext,
  TriageOutput,
} from "../agents/types";

const KNOWN_INTENTS = [
  "knowledge_query",
  "return_request",
  "refund_request",
  "order_status",
  "kyc_verification",
  "promo_apply",
  "escalate",
  "greeting",
];

export class Orchestrator {
  async runTurn(input: OrchestratorTurnInput): Promise<OrchestratorTurnOutput> {
    const audit = makeAuditEmitter(input.conversationId, input.tenantId);
    const ctx: SkillContext = {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      audit,
    };

    await audit.emit("turn_start", { message: input.message });

    // 1. Load memory.
    const memCtx = await memoryService.load({
      conversationId: input.conversationId,
      customerId: input.customerId,
    });

    // 2. Triage.
    const triage: TriageOutput = await triageSkill.run(
      { message: input.message, history: memCtx.history, knownIntents: KNOWN_INTENTS },
      ctx
    );
    await audit.emit("route_decision", {
      intent: triage.intent,
      subAgent: triage.subAgent,
      journeyId: triage.journeyId,
      confidence: triage.confidence,
      rationale: triage.rationale,
    });

    // 3. Dispatch to sub-agent.
    const sub = selectSubAgent(triage);
    const variables = input.variables ?? {};
    const subOut = await sub.run(
      { message: input.message, triage, context: memCtx, variables },
      ctx
    );

    // 4. Supervisor check.
    const supervisor = await supervisorAgent.check(
      {
        response: subOut.response,
        citations: subOut.citations,
        passages: memCtx.knowledge,
        variables: subOut.variables,
      },
      ctx
    );

    let finalResponse = subOut.response;
    if (supervisor.rewrittenContent) {
      finalResponse = supervisor.rewrittenContent;
    }

    await audit.emit("turn_end", {
      subAgent: sub.name,
      done: subOut.done,
      supervisorPass: supervisor.pass,
    });

    return {
      response: finalResponse,
      subAgent: sub.name,
      intent: triage.intent,
      variables: subOut.variables,
      toolCalls: subOut.toolCalls,
      citations: subOut.citations,
      supervisor,
      done: subOut.done,
      actions: subOut.actions,
    };
  }
}

export const orchestrator = new Orchestrator();
