// SupervisorAgent — per-turn safety check. Hard policy rules + soft LLM judge.

import { policyChecker } from "../policy";
import { callModel } from "../model-router";
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

const JUDGE_SYSTEM =
  "You are a response supervisor. Score the agent reply on three dimensions: " +
  "grounded (the reply is supported by the provided passages), " +
  "on_topic (the reply is about customer support, not other topics), " +
  "tone (professional, empathetic). " +
  'Return JSON: {grounded: boolean, on_topic: boolean, tone_ok: boolean, issues: string[]}. ' +
  "If passages are empty, grounded must be true (no factual claim to ground).";

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

export class SupervisorAgent {
  async check(
    input: SupervisorCheckInput,
    ctx: { conversationId: string; tenantId: string; audit: AuditEmitter }
  ): Promise<SupervisorCheckOutput> {
    const issues: Issue[] = [];
    const hasPassages = !!(input.passages && input.passages.length > 0);

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

    // 2. Soft LLM judge (fail-open on errors / parse failures).
    let verdict: JudgeVerdict | null = null;
    try {
      const res = await callModel(
        [
          { role: "system", content: JUDGE_SYSTEM },
          { role: "user", content: buildJudgeUserPrompt(input.passages, input.response) },
        ],
        { tier: "small", jsonMode: true }
      );
      verdict = parseJudge((res.content ?? "").trim());
    } catch {
      verdict = null;
    }

    let softFail = false;
    if (!verdict) {
      issues.push({ kind: "ungrounded", detail: "judge unavailable; passing with warning" });
    } else {
      const detail = (verdict.issues ?? []).join("; ");
      if (!verdict.grounded) { softFail = true; issues.push({ kind: "ungrounded", detail: detail || "not grounded in passages" }); }
      if (!verdict.on_topic) { softFail = true; issues.push({ kind: "off_topic", detail: detail || "off topic" }); }
      if (!verdict.tone_ok)  { softFail = true; issues.push({ kind: "tone", detail: detail || "tone issue" }); }
    }

    // 3. Aggregate. Soft checks block via pass=false but never rewrite content.
    const out: SupervisorCheckOutput = { pass: !softFail, issues };
    await ctx.audit.emit("supervisor_check", { pass: out.pass, issues: out.issues, has_passages: hasPassages });
    return out;
  }
}

export const supervisorAgent = new SupervisorAgent();
