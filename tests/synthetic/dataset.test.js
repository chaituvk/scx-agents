"use strict";

/**
 * Validates the synthetic data generator.
 * Run: node tests/synthetic/dataset.test.js
 *
 * No server or DB required — exercises the generator in-memory and asserts
 * referential integrity, tenant isolation, schema conformance, and
 * determinism. This is the safety net that lets other tests trust the data.
 */

const assert = require("assert");
const { generate } = require("./generate");

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    failures++;
    console.log(`  fail ${name}`);
    console.log(`     ${err.message}`);
  }
}

const CONV_STATUS = new Set(["resolved", "open", "escalated", "pending"]);
const SENTIMENTS = new Set(["neutral", "positive", "negative"]);
const ROLES = new Set(["user", "agent"]);

console.log("\nSynthetic dataset tests");
console.log("=======================\n");

const dataset = generate({ conversationsPerTenant: 30, seed: 1337 });
const tenantIds = dataset.meta.tenants;

test("generates all three tenants", () => {
  assert.deepStrictEqual(tenantIds, ["r-mobile", "ichiba", "r-travel"]);
});

test("conversation counts match the requested volume", () => {
  for (const id of tenantIds) {
    assert.strictEqual(dataset.tenants[id].conversations.length, 30, `tenant ${id}`);
  }
});

test("summary totals match the actual row counts", () => {
  const t = { conversations: 0, messages: 0, flagged: 0, insights: 0 };
  for (const id of tenantIds) {
    const d = dataset.tenants[id];
    t.conversations += d.conversations.length;
    t.messages += d.messages.length;
    t.flagged += d.flagged.length;
    t.insights += d.insights.length;
  }
  assert.deepStrictEqual(t, dataset.meta.totals);
});

test("every id is globally unique", () => {
  const ids = new Set();
  for (const id of tenantIds) {
    const d = dataset.tenants[id];
    for (const list of [d.conversations, d.messages, d.insights, d.flagged]) {
      for (const row of list) {
        assert.ok(!ids.has(row.id), `duplicate id ${row.id}`);
        ids.add(row.id);
      }
    }
  }
});

test("referential integrity: messages/flags point at real conversations", () => {
  for (const id of tenantIds) {
    const d = dataset.tenants[id];
    const convIds = new Set(d.conversations.map((c) => c.id));
    for (const m of d.messages) {
      assert.ok(convIds.has(m.conversation_id), `orphan message ${m.id}`);
    }
    for (const f of d.flagged) {
      assert.ok(convIds.has(f.conversation_id), `orphan flag ${f.id}`);
    }
  }
});

test("tenant isolation: no row leaks across tenant boundaries", () => {
  for (const id of tenantIds) {
    const d = dataset.tenants[id];
    const convById = new Map(d.conversations.map((c) => [c.id, c]));
    for (const list of [d.conversations, d.messages, d.insights, d.flagged]) {
      for (const row of list) {
        assert.strictEqual(row.tenant_id, id, `row ${row.id} has tenant_id ${row.tenant_id}`);
      }
    }
    // A message's tenant must equal its conversation's tenant.
    for (const m of d.messages) {
      assert.strictEqual(convById.get(m.conversation_id).tenant_id, m.tenant_id);
    }
  }
});

test("conversations conform to the schema enums", () => {
  for (const id of tenantIds) {
    for (const c of dataset.tenants[id].conversations) {
      assert.ok(c.customer_name && c.customer_email.includes("@"), `bad contact ${c.id}`);
      assert.ok(CONV_STATUS.has(c.status), `bad status ${c.status}`);
      assert.ok(SENTIMENTS.has(c.sentiment), `bad sentiment ${c.sentiment}`);
      assert.ok(!Number.isNaN(Date.parse(c.created_at)), `bad created_at ${c.id}`);
      assert.ok(Date.parse(c.updated_at) >= Date.parse(c.created_at), `updated < created ${c.id}`);
    }
  }
});

test("messages are well-formed and threads open with a user turn", () => {
  for (const id of tenantIds) {
    const d = dataset.tenants[id];
    const byConv = new Map();
    for (const m of d.messages) {
      assert.ok(ROLES.has(m.role), `bad role ${m.role}`);
      assert.ok(typeof m.content === "string" && m.content.length > 0, `empty content ${m.id}`);
      if (m.role === "agent") {
        assert.ok(m.confidence > 0 && m.confidence <= 1, `bad confidence ${m.id}`);
      } else {
        assert.strictEqual(m.confidence, null);
        assert.strictEqual(m.agent_id, null);
      }
      if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, []);
      byConv.get(m.conversation_id).push(m);
    }
    for (const [convId, msgs] of byConv) {
      assert.strictEqual(msgs[0].role, "user", `thread ${convId} opens with ${msgs[0].role}`);
      assert.ok(msgs[0].intent, `opener of ${convId} missing intent`);
    }
  }
});

test("insights cover 30 days × 5 metrics per tenant with sane ranges", () => {
  for (const id of tenantIds) {
    const ins = dataset.tenants[id].insights;
    assert.strictEqual(ins.length, 150, `tenant ${id} insight count`);
    const dates = new Set(ins.map((i) => i.date));
    assert.strictEqual(dates.size, 30, `tenant ${id} distinct dates`);
    for (const row of ins) {
      assert.ok(row.value >= 0, `negative metric ${row.id}`);
      if (row.metric === "csat") assert.ok(row.value <= 5, `csat > 5 ${row.id}`);
      if (row.metric === "resolution_rate" || row.metric === "deflection_rate") {
        assert.ok(row.value <= 100, `rate > 100 ${row.id}`);
      }
    }
  }
});

test("generation is deterministic for a fixed seed", () => {
  const a = generate({ conversationsPerTenant: 20, seed: 999 });
  const b = generate({ conversationsPerTenant: 20, seed: 999 });
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), "same seed produced different output");
});

test("different seeds produce different data", () => {
  const a = generate({ conversationsPerTenant: 20, seed: 1 });
  const b = generate({ conversationsPerTenant: 20, seed: 2 });
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(b));
});

if (failures) {
  console.log(`\n${failures} test(s) failed\n`);
  process.exit(1);
}
console.log("\nAll synthetic dataset tests passed\n");
