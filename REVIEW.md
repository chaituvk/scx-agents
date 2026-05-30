# Dev Branch Review — PR #4 (CX Runtime Unification)

**Scope:** architecture & runtime correctness of commits `7810e0b..7ac3b42`
(16 staged commits unifying chat entry behind a single orchestrator, plus the
PR #3 follow-up that reordered triage keywords).
**Branch reviewed:** `dev` (merged to `main` on 2026-05-06 via PR #4).
**Not in scope (per reviewer request):** security & tenant isolation,
frontend / studio UI, CI & test infrastructure.

## Summary

The unification is well-structured: one `Orchestrator` owns each turn, sub-agents
are profile-gated per tenant, hybrid execution gains real node-level policy
gating with pause-for-approval, and an append-only audit trail spans every
decision path. The supervisor's layered safety check and the session-aware
triage are particularly good.

There are nine concrete correctness issues worth fixing before this codebase
takes serious production traffic. Two are HIGH (silent inconsistency on
persistence failure during pause-for-approval; approval-resume can run against
the wrong journey if the original was deleted). Three are MEDIUM (hybrid
iteration-limit leaves the conversation hung; the supervisor's rewrite-failure
path is invisible in audit; the Stage-16 triage-validation fix has no
regression test). Four are LOW (engine-parity drift, topic-stack dedup, forced-
route audit gap, stale `subAgent` in held-for-approval envelope).

## Architecture overview

A POST to `/api/orchestrator` hits `Orchestrator.runTurn()`
(`src/lib/orchestrator/index.ts:122`), which loads memory + session snapshot +
tenant intent map in parallel, runs the `TriageSkill` (or accepts a forced
sub-agent hint), dispatches to the selected sub-agent
(`rag` / `workflow` / `tool` / `general` / `escalation`), runs the
`SupervisorAgent`, persists session state (last intent, active agent, topic
stack), and audits every step. Workflows execute via one of two engines —
`DialogEngine` (deterministic) or `NodeLevelHybridExecutor` (hybrid) — chosen
per `journey.execution_mode`. Hybrid nodes (`llm_extract`, `tool_call`,
`policy_check`, `llm_draft`) consult runtime profiles at the boundary and emit
structured `policy_decision` actions. A `policy_check` returning
`require_approval` parks the conversation; `POST /api/orchestrator/approve`
clears the lock and re-enters via a synthetic forced-workflow turn.

## End-to-end turn trace

1. **Entry** — `src/app/api/orchestrator/route.ts` POSTs `{conversationId,
   tenantId, message, customerId, variables}` into `orchestrator.runTurn()`.
2. **Load** — `orchestrator/index.ts:134-142` runs `memoryService.load`,
   `loadSession`, `loadIntentMap` in parallel.
3. **Pending-approval gate** — `orchestrator/index.ts:149-171` short-circuits
   to a held response if `pending_approval` exists and the caller did not
   supply a `forceSubAgent` / `requestedJourneyId` hint.
4. **Triage** — `orchestrator/index.ts:177-207` either constructs a forced
   `TriageOutput` from the hint, or calls `triageSkill.run` with session
   context + tenant intent map (`src/lib/skills/triage.ts:98`).
5. **Dispatch** — `selectSubAgent(triage)` picks one of five sub-agents and
   runs it (`orchestrator/index.ts:219-224`).
6. **Workflow sub-agent** — `src/lib/agents/workflow-agent.ts:117` resolves
   the journey, loads or creates `DialogState`, dispatches to
   `NodeLevelHybridExecutor` or `DialogEngine`, detects a paused
   `policy_check` (line 173-227), validates slot writes + api calls
   (line 230-278), persists dialog state.
7. **Supervisor** — `src/lib/agents/supervisor.ts:120-228` runs hard policy,
   off-limit phrases, soft LLM judge, optional rewrite, audits the result.
8. **Persist session** — `orchestrator/index.ts:245-263` reconciles the topic
   stack and upserts `last_intent`, `active_agent`, `topic_stack`.
9. **Return** — `OrchestratorTurnOutput` with `response`, `subAgent`,
   `intent`, `variables`, `supervisor`, `done`, `actions`, optional
   `pendingApproval`.

## Findings

### HIGH

#### F1 — Pending-approval persistence failure desyncs the conversation

**Where:** `src/lib/agents/workflow-agent.ts:199-227`

**Current behavior:** the upsert that writes `pending_approval` is wrapped in
try/catch (line 199-215); on failure it logs the error and emits a
`policy_event` but still returns the `PendingApproval` object to the caller
(line 221-227). The orchestrator wraps it into the response, but the dialog
state row has no `pending_approval` field set. A subsequent
`POST /api/orchestrator/approve` will 404 at `approve/route.ts:46-48`
(`!state.pending_approval`), and the next user turn skips the pending-approval
gate at `orchestrator/index.ts:149` — execution resumes as if nothing paused,
running whatever node comes after the `policy_check` without an approval.

**Impact:** approvers cannot resume the conversation; meanwhile the user can
continue talking and silently advance past the policy gate. Policy bypass.

**Suggested fix:** in the persistence-failure branch, do not return
`pendingApproval`. Either throw so the orchestrator can return a 5xx, or
return a structured held-error response:

```ts
try {
  await dialogStateRepo.upsertByConversationForTenant(ctx.tenantId, ctx.conversationId, {
    journey_id: journey.id,
    current_node_id: result.state.currentNodeId,
    variables: result.state.variables,
    history: result.state.history,
    context: result.state.context,
    pending_approval: pendingApproval as unknown as Record<string, unknown>,
    done: 0,
  });
} catch (err) {
  console.error("[workflowAgent] pending_approval persistence failed:", err);
  await ctx.audit.emit("policy_event", {
    decision: "deny", target: "persistence",
    reason: err instanceof Error ? err.message : String(err),
  });
  // Do NOT return a pendingApproval the system can't resume.
  throw new Error("Failed to persist pending approval — conversation not parked");
}
```

#### F2 — Approval-resume runs the wrong journey if the original was deleted

**Where:** `src/app/api/orchestrator/approve/route.ts:96-103`,
`src/lib/agents/workflow-agent.ts:69-77, 119-121`

**Current behavior:** `/approve` always calls
`orchestrator.runTurn({forceSubAgent: "workflow", requestedJourneyId: pending.journeyId, ...})`.
The orchestrator's forced path (`orchestrator/index.ts:177-189`) only looks up
the journey when `forceSubAgent` is missing, so it skips the existence check
and hands `requestedJourneyId` straight to `workflow-agent`.
`resolveJourney` calls `journeyRepo.findByIdForTenant` and on miss falls back
to *any* active journey for the tenant (line 74-76). The synthetic resume
then runs against an unrelated journey.

**Impact:** if the original journey was deleted, renamed, or moved to draft
between the pause and the approval, the approve endpoint silently executes a
different workflow. Cross-journey state contamination.

**Suggested fix:** `resolveJourney` should refuse to substitute when the
caller explicitly named a journey. Change line 69-77 to:

```ts
async function resolveJourney(triage: TriageOutput, tenantId: string) {
  if (triage.journeyId) {
    const j = await journeyRepo.findByIdForTenant(triage.journeyId, tenantId);
    if (j) return { journey: toDialogJourney(j as RawJourney), raw: j as RawJourney };
    return null;   // do NOT silently fall back when a journey was requested
  }
  const all = await journeyRepo.findAll(tenantId);
  const active = all.find((j) => j.status === "active") ?? all[0];
  return active ? { journey: toDialogJourney(active as RawJourney), raw: active as RawJourney } : null;
}
```

And have `approve/route.ts` translate a `NO_WORKFLOW` resumed response into
a `409 Conflict` so the operator knows the original journey is gone.

### MEDIUM

#### F3 — Hybrid iteration-limit leaves the conversation hung

**Where:** `src/lib/runtime/hybrid-executor.ts:92-114`

**Current behavior:** on the 100-iteration cap, `processNodeChain` returns
`done: false`, an empty `messages` array, and one `policy_decision` deny
action (line 112). `workflow-agent` then persists `done: 0`, falls back to
`"Let me start the workflow."` (workflow-agent.ts:305), and the next user
turn re-enters the same loop.

**Impact:** the conversation cannot make forward progress and the user sees
no signal that something is wrong; the audit shows a deny but the UX is a
silent hang.

**Suggested fix:** treat overrun as terminal, surface a user-visible message,
and escalate:

```ts
actions.push({
  type: "transfer",
  payload: { reason: "Hybrid execution exceeded iteration limit" },
});
return {
  messages: [
    "I'm having trouble completing this — let me get a teammate to take over.",
  ],
  state,
  done: true,
  actions,
};
```

#### F4 — Supervisor rewrite-failure is invisible in audit

**Where:** `src/lib/agents/supervisor.ts:210-227`

**Current behavior:** `rewrittenContent = rewritten ?? SAFE_FALLBACK`
(line 217). The audit event records `rewritten: !!rewrittenContent`
(line 225), which is always `true` in this branch. Operators cannot tell
whether the LLM rewrote successfully or whether the rewrite call failed and
the user saw the canned fallback instead.

**Impact:** silent degradation of response quality. If the rewrite endpoint
starts failing in production, the dashboards still look green.

**Suggested fix:**

```ts
let rewrittenContent: string | undefined;
let rewriteFallback = false;
if (softFail && rewriteIssueDetail) {
  const rewritten = await rewriteForIssue(input.response, input.passages, rewriteIssueDetail, tone);
  if (rewritten === null) rewriteFallback = true;
  rewrittenContent = rewritten ?? SAFE_FALLBACK;
}

const out: SupervisorCheckOutput = { pass: !softFail, issues, rewrittenContent };
await ctx.audit.emit("supervisor_check", {
  pass: out.pass,
  issues: out.issues,
  has_passages: hasPassages,
  rewritten: !!rewrittenContent,
  rewriteFallback,   // NEW
});
```

#### F5 — Stage-16 triage validation has no regression test

**Where:** `src/lib/skills/triage.ts:118-131`, `tests/orchestrator.test.js`

**Current behavior:** Stage 16 added `VALID_SUB_AGENTS` validation so an LLM
error envelope (`{"error":"No LLM provider available"}`) no longer silently
routes every turn to RAG. The fix is correct but not under test — a future
refactor that re-flattens the validation could regress without warning.

**Impact:** the exact bug this stage fixed could reappear unnoticed.

**Suggested fix:** add a unit test that injects a non-triage JSON response
and asserts the result came from `keywordFallback`:

```js
// tests/triage.test.js
import { triageSkill } from "../src/lib/skills/triage.ts";
// mock callModel to return {"error":"No LLM provider available"}
const result = await triageSkill.run(
  { message: "I need a refund", history: [], knownIntents: [], session: {} },
  { conversationId: "c1", tenantId: "t1", audit: { emit: async () => {} } }
);
assert.equal(result.rationale, "keyword fallback");
assert.equal(result.subAgent, "workflow");
```

Add a `test` script to `package.json` while you're there — it's currently
missing, so CI cannot invoke `npm test` to run any of the existing tests.

### LOW

#### F6 — Two-engine semantics drift is documented but not parity-tested

**Where:** `src/lib/agents/workflow-agent.ts:1-21` (file header)

**Current behavior:** the file-header comment acknowledges that
`NodeLevelHybridExecutor.processNodeChain` and `DialogEngine.processNodeChain`
stop on different rules, and promises "Stage 4+ may unify if hybrid's chain
semantics are brought into line." There is no test that pins down message or
turn boundaries on a deterministic journey, so flipping
`journey.execution_mode` from `"deterministic"` to `"hybrid"` could silently
change recorded conversation transcripts.

**Impact:** migrations land without warning.

**Suggested fix:** add a parity test fixture. Pick one or two deterministic
journeys (returns, refunds), drive them through both engines with the same
input transcript, assert `messages[]` and final `state.variables` match.

#### F7 — Topic-stack push doesn't dedup against deeper frames

**Where:** `src/lib/orchestrator/index.ts:105-117`

**Current behavior:** `alreadyTracking` checks only the top frame. A user who
detours → returns → detours again to the same `(journeyId, nodeId)` ends up
with a duplicate frame deeper in the stack. There's no cap on stack depth.

**Impact:** unbounded growth of `topic_stack` for chatty users; redundant
frames degrade the "return to previous topic" UX.

**Suggested fix:** scan the full stack before pushing, and cap depth:

```ts
const isAlreadyInStack = stack.some(
  (f) => f.journeyId === session.activeJourneyId && f.nodeId === session.currentNodeId
);
if (!isAlreadyInStack) {
  stack.push({ /* … */ });
  while (stack.length > 5) stack.shift();
}
```

#### F8 — Forced-route path skips orchestrator-level journey audit

**Where:** `src/lib/orchestrator/index.ts:177-189`

**Current behavior:** when a caller passes `forceSubAgent: "workflow"` but
no `requestedJourneyId`, the orchestrator records a `route_decision` audit
event with `journeyId: undefined` and dispatches into `workflow-agent`,
which picks the first active journey for the tenant. No warning surfaces
the missing hint.

**Impact:** a future caller that forgets to specify `requestedJourneyId`
silently runs against an arbitrary journey.

**Suggested fix:** emit a distinct audit event when the hint is incomplete:

```ts
if (input.forceSubAgent === "workflow" && !input.requestedJourneyId) {
  await audit.emit("policy_event", {
    decision: "deny",
    target: "forced_route",
    reason: "forceSubAgent=workflow without requestedJourneyId; falling back to first active journey",
  });
}
```

#### F9 — Held-for-approval response tags `subAgent` with stale state

**Where:** `src/lib/orchestrator/index.ts:158, 162-163`

**Current behavior:** the held branch returns
`subAgent: session.activeAgent ?? "workflow"`. Only `workflow-agent` emits
`pendingApproval` today, so `activeAgent` *should* always be `"workflow"`,
but the code trusts whatever was last persisted — which could be `"rag"`
after a knowledge detour completed cleanly between the pause and a fresh
turn that hits the gate.

**Impact:** mislabeled telemetry; minor, but the held envelope is exactly
where you want clean signal.

**Suggested fix:** hard-code `subAgent: "workflow"` in the held envelope:

```ts
return {
  response: heldResponse,
  subAgent: "workflow",   // pendingApproval is only emitted by workflow-agent
  intent: "held_for_approval",
  // …
};
```

## Strengths (preserve as-is)

- **Layered supervisor** (`src/lib/agents/supervisor.ts:120-228`): hard policy
  → tenant off-limit phrases → soft LLM judge → optional rewrite, each layer
  audited. The fail-closed-on-hard, fail-open-on-soft posture is right.
- **Node-level pre-execution policy gating** (`src/lib/runtime/hybrid-executor.ts`):
  runtime profiles are consulted at every `llm_extract`, `tool_call`,
  `policy_check`, `llm_draft` boundary; deny / require_approval emit
  structured `policy_decision` actions consumable by the audit pipeline.
- **Session-aware triage** (`src/lib/skills/triage.ts:26-88`,
  `src/lib/orchestrator/index.ts:191-207`): short or ambiguous mid-workflow
  turns continue the workflow; substantive wh-questions classify as knowledge
  detours; tenant intent map overrides LLM routing. The PR #3 tool-vs-workflow
  keyword reorder is exactly the right call.
- **Comprehensive append-only audit** (`src/lib/audit/`,
  `src/lib/audit/from-actions.ts`, repositories): every `route_decision`,
  `policy_event`, `slot_write`, `supervisor_check`, `journey_transition`
  flows through one emitter passed via `SkillContext` — easy to extend and
  hard to bypass.

## Files referenced

- `src/lib/orchestrator/index.ts`
- `src/lib/agents/workflow-agent.ts`
- `src/lib/agents/supervisor.ts`
- `src/lib/skills/triage.ts`
- `src/lib/runtime/hybrid-executor.ts`
- `src/app/api/orchestrator/route.ts`
- `src/app/api/orchestrator/approve/route.ts`
- `src/lib/repositories/dialog-state.ts`
- `RUNTIME_ARCHITECTURE.md`, `AGENT_OS_DESIGN.md`
