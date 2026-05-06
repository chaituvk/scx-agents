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

  // Default: free-form chat → general agent. Knowledge/workflow/tool/escalation
  // each match on explicit signals; everything else (greetings, smalltalk,
  // acknowledgments, vague questions) lands on general.
  //
  // Ordering matters: substantive wh-questions fire BEFORE workflow keyword
  // matching so "What is your return window?" routes to RAG instead of being
  // captured by the \breturn\b workflow branch. A wh-question about a
  // workflow concept ("what is your refund policy") is a knowledge query;
  // a workflow trigger is phrased without a wh-word ("I need a refund").
  let subAgent: SubAgentName = "general";
  let intent = "general_chat";
  if (/\b(human|manager|agent|representative)\b/.test(m)) {
    subAgent = "escalation";
    intent = "escalate";
  } else if (/\b(what|how|why|when|where|who)\b/.test(m) && m.split(/\s+/).length >= 4) {
    // Substantive wh-question → likely a knowledge query worth retrieving for.
    // Short wh-questions ("what?", "how come?") fall through to general.
    subAgent = "rag";
    intent = "knowledge_query";
  } else if (/\b(lookup|check|status)\b/.test(m)) {
    // Tool keywords fire before workflow keywords because read-only
    // single-step lookups ("check my order status") are tool intents
    // even when they mention a workflow noun ("order"). A genuine
    // workflow trigger ("I need a refund for my order") has no
    // tool keyword and falls through to the workflow branch below.
    subAgent = "tool";
    intent = "tool_use";
  } else if (/\b(return|refund|order|cancel|kyc)\b/.test(m)) {
    subAgent = "workflow";
    intent = "workflow";
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
Allowed sub-agents:
- "rag" — substantive questions answerable from a knowledge base (policies, product details, how-to). Pick this only when retrieval would help.
- "workflow" — multi-step processes (returns, refunds, KYC, cancellations).
- "tool" — single lookups (order status, balance, tracking).
- "escalation" — explicit request for a human / manager / live agent.
- "general" — greetings, thanks, small talk, acknowledgments, off-topic chatter, vague clarifying messages, or anything that doesn't fit the four above.
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
    // Validate the parsed JSON actually describes a triage decision, not
    // just any JSON the LLM (or an LLM-error envelope like
    // {"error":"No LLM provider available..."}) happened to return. Without
    // this check, parseJson succeeds on the error envelope, parsed.subAgent
    // is undefined, and the `?? "rag"` fallback silently routes every turn
    // to RAG — a real bug that surfaced when running tests/orchestrator.
    // test.js with no LLM credentials configured.
    const VALID_SUB_AGENTS: SubAgentName[] = ["rag", "workflow", "tool", "escalation", "general"];
    const rawSubAgent = parsed.subAgent;
    if (typeof rawSubAgent !== "string" || !VALID_SUB_AGENTS.includes(rawSubAgent as SubAgentName)) {
      return keywordFallback(input.message, input.session);
    }
    const subAgent = rawSubAgent as SubAgentName;
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
