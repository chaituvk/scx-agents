// SupervisorAgent — per-turn safety check.
//
// Layers (Stage 10):
//   1. Hard policy check (policyChecker.validateResponse) — covers SSN/CC
//      PII via piiInResponse rule. Deny → SAFE_FALLBACK rewrite.
//   2. Tenant off-limit phrases — verbatim case-insensitive match against
//      the tenant's configured off_limit_phrases list. Deny → SAFE_FALLBACK.
//   3. LLM judge — grounded / on_topic / tone, prompt enriched with the
//      tenant's tone target and off_limit_topics so the judge knows what
//      "off topic" means for this tenant specifically.
//   4. Soft-fail rewrite — when the judge flags grounded=false (with
//      passages) or on_topic=false, request an LLM rewrite that addresses
//      the issue. Tone-only failures don't trigger rewrite (over-firing
//      risk; the issue is still recorded in supervisor_check audit).
//      If the rewrite call fails or returns empty, fall back to
//      SAFE_FALLBACK rather than letting the unsafe response through.
//
// Failure surface: the orchestrator already uses supervisor.rewrittenContent
// when present. Before this stage, soft failures returned pass=false but no
// rewritten content — meaning the original failing response went to the
// user. After this stage, every pass=false outcome carries a rewritten
// response.

import { policyChecker } from "../policy";
import { callModel } from "../model-router";
import { tenantRepo } from "../repositories";
import { analyzeSentiment } from "../skills/sentiment";
import type {
  AuditEmitter,
  RetrievePassage,
  SupervisorCheckInput,
  SupervisorCheckOutput,
} from "./types";

type Issue = SupervisorCheckOutput["issues"][number];

interface JudgeVerdict {
  grounded: boolean;
  on_topic: boolean;
  tone_ok: boolean;
  issues: string[];
}

const SAFE_FALLBACK =
  "I'm not able to share that. Let me connect you with a teammate who can help.";

function buildJudgeSystemPrompt(tone: string | undefined, offLimitTopics: string[]): string {
  const toneClause = tone ? `Required tone: ${tone}.` : "Required tone: professional, empathetic.";
  const topicsClause = offLimitTopics.length > 0
    ? `Off-topic in this context includes: ${offLimitTopics.join(", ")}.`
    : "";
  return [
    "You are a response supervisor. Score the agent reply on three dimensions:",
    "grounded (the reply is supported by the provided passages),",
    "on_topic (the reply is about customer support, not other topics),",
    "tone (matches the required tone).",
    `Return JSON: {grounded: boolean, on_topic: boolean, tone_ok: boolean, issues: string[]}.`,
    "If passages are empty, grounded must be true (no factual claim to ground).",
    toneClause,
    topicsClause,
  ].filter(Boolean).join(" ");
}

function buildJudgeUserPrompt(passages: RetrievePassage[] | undefined, response: string): string {
  const block =
    passages && passages.length > 0
      ? `PASSAGES:\n${passages.map((p) => `[${p.source}] ${p.title}: ${p.content}`).join("\n")}\n\n`
      : "PASSAGES: (none)\n\n";
  return `${block}AGENT REPLY:\n${response}`;
}

function parseJudge(raw: string): JudgeVerdict | null {
  try { return JSON.parse(raw) as JudgeVerdict; } catch { /* fall through */ }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as JudgeVerdict; } catch { return null; }
}

function findOffLimitMatch(content: string, phrases: string[]): string | null {
  const lower = content.toLowerCase();
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

async function rewriteForIssue(
  original: string,
  passages: RetrievePassage[] | undefined,
  issueDetail: string,
  tone: string | undefined,
): Promise<string | null> {
  const passagesBlock =
    passages && passages.length > 0
      ? `KNOWLEDGE PASSAGES:\n${passages.map((p) => `[${p.source}] ${p.title}: ${p.content}`).join("\n")}\n\n`
      : "";
  const sys =
    "You rewrite an agent reply to fix a specific supervisor-flagged issue. " +
    "Preserve the original intent. Stay concise (1-3 sentences). " +
    `Required tone: ${tone || "professional, empathetic"}. ` +
    "If the original made an unsupported factual claim, drop the claim and offer a safe alternative " +
    "(e.g. \"let me check\" or \"I can connect you with someone who can help\"). " +
    "Return ONLY the rewritten reply text — no preamble, no JSON.";
  const user = `${passagesBlock}ISSUE TO FIX: ${issueDetail}\n\nORIGINAL REPLY:\n${original}\n\nREWRITTEN REPLY:`;
  try {
    const res = await callModel(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { tier: "small" }
    );
    const rewritten = (res.content ?? "").trim();
    return rewritten.length > 0 ? rewritten : null;
  } catch {
    return null;
  }
}

interface EscalationSignals {
  turnCount: number;
  negSentimentCount: number;
  toolFailureCount: number;
  policyDenyCount: number;
  hasPendingApproval: boolean;
}

function predictEscalationRisk(signals: EscalationSignals): number {
  let risk = 0;
  if (signals.negSentimentCount >= 2) risk += 0.4;
  if (signals.negSentimentCount >= 1) risk += 0.15;
  if (signals.toolFailureCount >= 2) risk += 0.3;
  if (signals.toolFailureCount >= 1) risk += 0.1;
  if (signals.policyDenyCount >= 1) risk += 0.2;
  if (signals.turnCount > 10) risk += 0.15;
  if (signals.hasPendingApproval) risk += 0.2;
  return Math.min(risk, 1.0);
}

export class SupervisorAgent {
  async check(
    input: SupervisorCheckInput,
    ctx: { conversationId: string; tenantId: string; audit: AuditEmitter }
  ): Promise<SupervisorCheckOutput> {
    const issues: Issue[] = [];
    const hasPassages = !!(input.passages && input.passages.length > 0);

    const tenant = await tenantRepo.findById(ctx.tenantId).catch(() => null);
    const offLimitPhrases = Array.isArray(tenant?.off_limit_phrases) ? tenant!.off_limit_phrases! : [];
    const offLimitTopics = Array.isArray(tenant?.off_limit_topics) ? tenant!.off_limit_topics! : [];
    const tone = tenant?.tone;

    // 1. Hard policy check (fail-closed on deny).
    const policyResult = await policyChecker.validateResponse({
      content: input.response,
      citations: input.citations,
      variables: input.variables,
    });

    if (policyResult.decision === "deny") {
      const out: SupervisorCheckOutput = {
        pass: false,
        issues: [{ kind: "policy", detail: policyResult.reason }],
        rewrittenContent: SAFE_FALLBACK,
      };
      await ctx.audit.emit("supervisor_check", { pass: false, issues: out.issues, has_passages: hasPassages });
      return out;
    }
    if (policyResult.decision === "require_approval") {
      issues.push({ kind: "policy", detail: policyResult.reason });
    }

    // 2. Tenant off-limit phrases — verbatim match.
    const offLimitHit = findOffLimitMatch(input.response, offLimitPhrases);
    if (offLimitHit) {
      const out: SupervisorCheckOutput = {
        pass: false,
        issues: [{ kind: "policy", detail: `Response contained off-limit phrase: "${offLimitHit}"` }],
        rewrittenContent: SAFE_FALLBACK,
      };
      await ctx.audit.emit("supervisor_check", { pass: false, issues: out.issues, has_passages: hasPassages });
      return out;
    }

    // 3. Soft LLM judge (fail-open on errors / parse failures).
    let verdict: JudgeVerdict | null = null;
    try {
      const res = await callModel(
        [
          { role: "system", content: buildJudgeSystemPrompt(tone, offLimitTopics) },
          { role: "user", content: buildJudgeUserPrompt(input.passages, input.response) },
        ],
        { tier: "small", jsonMode: true }
      );
      verdict = parseJudge((res.content ?? "").trim());
    } catch {
      verdict = null;
    }

    let softFail = false;
    let rewriteIssueDetail: string | null = null;
    if (!verdict) {
      issues.push({ kind: "ungrounded", detail: "judge unavailable; passing with warning" });
    } else {
      const detail = (verdict.issues ?? []).join("; ");
      // grounded=false only matters when passages were provided — without
      // passages the judge is told to mark grounded=true, but a buggy LLM
      // might still flag it. We only rewrite when there's something to
      // ground against.
      if (!verdict.grounded && hasPassages) {
        softFail = true;
        const d = detail || "not grounded in passages";
        issues.push({ kind: "ungrounded", detail: d });
        rewriteIssueDetail = `Reply makes claims not supported by the provided passages: ${d}`;
      }
      if (!verdict.on_topic) {
        softFail = true;
        const d = detail || "off topic";
        issues.push({ kind: "off_topic", detail: d });
        if (!rewriteIssueDetail) rewriteIssueDetail = `Reply is off topic for customer support: ${d}`;
      }
      if (!verdict.tone_ok) {
        // Tone alone doesn't trigger rewrite — over-firing risk and the
        // issue is recorded for review. softFail stays true so pass=false.
        softFail = true;
        issues.push({ kind: "tone", detail: detail || "tone issue" });
      }
    }

    // 4. Soft-fail rewrite. Only attempt if we have a concrete issue
    // worth rewriting around (grounded / on_topic). If rewrite fails or
    // returns empty, fall back to SAFE_FALLBACK rather than letting the
    // unsafe response through.
    let rewrittenContent: string | undefined;
    if (softFail && rewriteIssueDetail) {
      const rewritten = await rewriteForIssue(input.response, input.passages, rewriteIssueDetail, tone);
      rewrittenContent = rewritten ?? SAFE_FALLBACK;
    }

    // 5. Sentiment analysis on the agent response.
    const sentiment = await analyzeSentiment(input.response).catch(() => undefined);

    // 6. Predictive escalation risk based on current check's issues.
    const escalationSignals: EscalationSignals = {
      turnCount: 0, // unknown without DB query
      negSentimentCount: issues.filter(i => i.kind === 'off_topic' || i.kind === 'tone').length,
      toolFailureCount: 0,
      policyDenyCount: issues.filter(i => i.kind === 'policy').length,
      hasPendingApproval: false,
    };
    const escalationRisk = predictEscalationRisk(escalationSignals);
    const shouldEscalate = escalationRisk >= 0.6;

    const out: SupervisorCheckOutput = { pass: !softFail, issues, rewrittenContent, sentiment, escalationRisk, shouldEscalate };
    await ctx.audit.emit("supervisor_check", {
      pass: out.pass,
      issues: out.issues,
      has_passages: hasPassages,
      rewritten: !!rewrittenContent,
      sentiment_score: sentiment?.score,
      sentiment_confidence: sentiment?.confidence,
      escalation_risk: escalationRisk,
      should_escalate: shouldEscalate,
    });
    return out;
  }
}

export const supervisorAgent = new SupervisorAgent();
