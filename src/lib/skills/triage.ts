// TriageSkill — classifies user intent and routes to a sub-agent.

import { callModel } from "../model-router";
import type {
  Skill,
  SkillContext,
  TriageInput,
  TriageOutput,
  SubAgentName,
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

function keywordFallback(message: string, session?: TriageInput["session"]): TriageOutput {
  const m = message.toLowerCase();

  // If a workflow is already active and the message is short or ambiguous
  // (no clear intent shift signal), continue the workflow.
  if (session?.activeJourneyId && !/\b(human|manager|agent|representative|stop|cancel|exit)\b/.test(m)) {
    const isQuestion = /\b(what|how|why|when|where|who)\b/.test(m);
    if (!isQuestion || m.split(/\s+/).length < 4) {
      return {
        intent: "continue_workflow",
        journeyId: session.activeJourneyId,
        subAgent: "workflow",
        confidence: 0.55,
        rationale: "session-aware fallback: continuing active workflow",
      };
    }
  }

  let subAgent: SubAgentName = "rag";
  let intent = "knowledge_query";
  if (/\b(human|manager|agent|representative)\b/.test(m)) {
    subAgent = "escalation";
    intent = "escalate";
  } else if (/\b(return|refund|order|cancel|kyc)\b/.test(m)) {
    subAgent = "workflow";
    intent = "workflow";
  } else if (/\b(lookup|check|status)\b/.test(m)) {
    subAgent = "tool";
    intent = "tool_use";
  } else if (/\b(what|how|why)\b/.test(m)) {
    subAgent = "rag";
    intent = "knowledge_query";
  }
  return { intent, subAgent, confidence: 0.4, rationale: "keyword fallback" };
}

function sessionContextLines(session?: TriageInput["session"]): string {
  if (!session?.activeJourneyId) return "";
  const stackHint = session.topicStackDepth && session.topicStackDepth > 0
    ? `The user has ${session.topicStackDepth} paused topic(s) on the stack — they may want to return to one.`
    : "";
  return `\nSession context:
- Active workflow journey: ${session.activeJourneyId}${session.currentNodeId ? ` (at node ${session.currentNodeId})` : ""}
- Last intent: ${session.lastIntent ?? "none"}
${stackHint}
Default to continuing the active workflow unless the user clearly switches topic. If they ask a knowledge question mid-workflow, classify as "rag" (a temporary detour) — the orchestrator preserves the workflow position.`;
}

function intentMapLines(intentMap?: Record<string, string>): string {
  if (!intentMap || Object.keys(intentMap).length === 0) return "";
  const entries = Object.entries(intentMap)
    .map(([intent, journeyId]) => `  ${intent} -> ${journeyId}`)
    .join("\n");
  return `\nTenant intent → journey map (use these journey ids when assigning journeyId):\n${entries}`;
}

export const triageSkill: Skill<TriageInput, TriageOutput> = {
  name: "triage",
  async run(input: TriageInput, _ctx: SkillContext): Promise<TriageOutput> {
    const sys = `You are a triage classifier. Classify the user's message into an intent and route it to a sub-agent.
Allowed sub-agents: "rag" (knowledge questions), "workflow" (multi-step processes like returns/refunds/kyc), "tool" (single lookups), "escalation" (handoff to human).
Known intents: ${input.knownIntents.join(", ") || "(none)"}.${sessionContextLines(input.session)}${intentMapLines(input.intentMap)}
Return JSON with keys: intent, journeyId (optional), specialistId (optional), subAgent, confidence (0..1), rationale.`;
    const user = `Message: ${input.message}`;
    const res = await callModel(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { tier: "small", jsonMode: true }
    );
    const parsed = parseJson(res.content);
    if (!parsed) return keywordFallback(input.message, input.session);
    const subAgent = (parsed.subAgent as SubAgentName) ?? "rag";
    let journeyId = parsed.journeyId ? String(parsed.journeyId) : undefined;
    // If the LLM didn't pick a journey but the intent has a mapped journey,
    // honor the router profile mapping.
    if (!journeyId && input.intentMap && parsed.intent && input.intentMap[String(parsed.intent)]) {
      journeyId = input.intentMap[String(parsed.intent)];
    }
    return {
      intent: String(parsed.intent ?? "unknown"),
      journeyId,
      specialistId: parsed.specialistId ? String(parsed.specialistId) : undefined,
      subAgent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      rationale: parsed.rationale ? String(parsed.rationale) : undefined,
    };
  },
};
