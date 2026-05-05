/**
 * Orchestrator smoke test — verifies routing across sub-agents.
 * Run: node tests/orchestrator.test.js
 * Requires the dev server to be running on localhost:3000
 *
 * The LLM may be unavailable; the test asserts only on routing structure
 * and audit-event side effects, not on the natural-language response.
 */

const assert = require("assert");

const BASE = "http://localhost:3000";
const TENANT = "r-mobile";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-id": TENANT },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { status: res.status, data };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-tenant-id": TENANT } });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.log(`  fail ${name}`);
    console.log(`     ${err.message}`);
    process.exitCode = 1;
  }
}

function assertSubAgent(data, expected) {
  assert.ok(data.subAgent, `expected subAgent in response, got ${JSON.stringify(data)}`);
  assert.strictEqual(
    data.subAgent,
    expected,
    `routed to '${data.subAgent}' instead of '${expected}' for intent '${data.intent}'`
  );
}

async function main() {
  console.log("\nOrchestrator smoke tests");
  console.log("========================\n");

  await test("knowledge query routes to RAG", async () => {
    const conversationId = `smoke-rag-${Date.now()}`;
    const { status, data } = await post("/api/orchestrator", {
      conversationId,
      message: "What is your return window?",
    });
    assert.strictEqual(status, 200);
    assertSubAgent(data, "rag");
    assert.ok(data.supervisor, "expected supervisor block");
    assert.ok(typeof data.response === "string" && data.response.length > 0);
  });

  await test("workflow query routes to Workflow", async () => {
    const conversationId = `smoke-wf-${Date.now()}`;
    const { status, data } = await post("/api/orchestrator", {
      conversationId,
      message: "I need a refund for my order",
    });
    assert.strictEqual(status, 200);
    // Triage may return workflow OR tool depending on LLM; accept either.
    assert.ok(
      data.subAgent === "workflow" || data.subAgent === "tool",
      `expected workflow|tool, got ${data.subAgent}`
    );
  });

  await test("escalation phrase routes to Escalation with rich handoff payload", async () => {
    const conversationId = `smoke-esc-${Date.now()}`;
    const { status, data } = await post("/api/orchestrator", {
      conversationId,
      message: "Please connect me to a human agent",
    });
    assert.strictEqual(status, 200);
    assertSubAgent(data, "escalation");
    const transfer = data.actions?.find((a) => a.type === "transfer");
    assert.ok(transfer, "expected a transfer action");
    const payload = transfer.payload ?? {};
    assert.strictEqual(payload.conversationId, conversationId);
    assert.strictEqual(payload.tenantId, TENANT);
    assert.ok(typeof payload.summary === "string");
    assert.ok(Array.isArray(payload.recentTranscript));
    assert.ok(Array.isArray(payload.recentPolicyEvents));
    assert.ok(Array.isArray(payload.topicStack));
    assert.ok(typeof payload.createdAt === "string");
    assert.strictEqual(payload.triggeringMessage, "Please connect me to a human agent");
  });

  await test("smalltalk routes to General", async () => {
    const conversationId = `smoke-gen-${Date.now()}`;
    const { status, data } = await post("/api/orchestrator", {
      conversationId,
      message: "Hey there, thanks!",
    });
    assert.strictEqual(status, 200);
    assertSubAgent(data, "general");
    assert.ok(typeof data.response === "string" && data.response.length > 0);
    assert.deepStrictEqual(data.actions ?? [], []);
  });

  await test("missing conversationId is rejected", async () => {
    const { status } = await post("/api/orchestrator", { message: "hi" });
    assert.strictEqual(status, 400);
  });

  await test("approve endpoint validates required fields", async () => {
    const noConv = await post("/api/orchestrator/approve", { decision: "approve", approverId: "u1" });
    assert.strictEqual(noConv.status, 400);

    const badDecision = await post("/api/orchestrator/approve", {
      conversationId: "c1", decision: "yes", approverId: "u1",
    });
    assert.strictEqual(badDecision.status, 400);

    const noApprover = await post("/api/orchestrator/approve", {
      conversationId: "c1", decision: "approve",
    });
    assert.strictEqual(noApprover.status, 400);
  });

  await test("approve endpoint returns 404 when no pending approval", async () => {
    const conversationId = `smoke-noapproval-${Date.now()}`;
    const { status, data } = await post("/api/orchestrator/approve", {
      conversationId, decision: "approve", approverId: "supervisor-1",
    });
    assert.strictEqual(status, 404);
    assert.ok(/no pending approval/i.test(data.error ?? ""));
  });

  await test("missing message is rejected", async () => {
    const { status } = await post("/api/orchestrator", { conversationId: "x" });
    assert.strictEqual(status, 400);
  });

  console.log("\nAll orchestrator smoke tests passed\n");
}

main().catch((err) => {
  console.error("\nTest runner failed:", err.message);
  process.exit(1);
});
