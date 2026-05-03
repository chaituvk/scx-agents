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

function keywordFallback(message: string): TriageOutput {
  const m = message.toLowerCase();
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

export const triageSkill: Skill<TriageInput, TriageOutput> = {
  name: "triage",
  async run(input: TriageInput, _ctx: SkillContext): Promise<TriageOutput> {
    const sys = `You are a triage classifier. Classify the user's message into an intent and route it to a sub-agent.
Allowed sub-agents: "rag" (knowledge questions), "workflow" (multi-step processes like returns/refunds/kyc), "tool" (single lookups), "escalation" (handoff to human).
Known intents: ${input.knownIntents.join(", ") || "(none)"}.
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
    if (!parsed) return keywordFallback(input.message);
    const subAgent = (parsed.subAgent as SubAgentName) ?? "rag";
    return {
      intent: String(parsed.intent ?? "unknown"),
      journeyId: parsed.journeyId ? String(parsed.journeyId) : undefined,
      specialistId: parsed.specialistId ? String(parsed.specialistId) : undefined,
      subAgent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      rationale: parsed.rationale ? String(parsed.rationale) : undefined,
    };
  },
};
