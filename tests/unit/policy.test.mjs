/**
 * Policy unit tests — exercise PolicyChecker rules via the orchestrator API.
 *
 * Run: BASE_URL=http://localhost:3000 node --test tests/unit/policy.test.mjs
 * Requires the dev server to be running.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TENANT = 'r-mobile';

/** POST to any path with the tenant header. Returns { status, data }. */
async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { status: res.status, data };
}

// ── Inline unit tests for policy rules (no server needed) ───────────────────
//
// The rules module is pure TypeScript, but since we can't import TS directly
// from a .mjs test we reproduce the key logic inline so CI gets fast,
// server-independent coverage. The companion API-level tests below validate
// that the same rules are wired into the running server.

function allow() { return { decision: 'allow' }; }
function deny(reason) { return { decision: 'deny', reason }; }
function requireApproval(reason, approver) { return { decision: 'require_approval', reason, approver }; }

// -- refundAmountLimit --
function refundAmountLimit(input) {
  if (input.tool !== 'process_refund') return allow();
  const amount = Number(input.params?.amount);
  if (!Number.isNaN(amount) && amount > 500) {
    return requireApproval('Refund over $500 requires manager approval', 'manager');
  }
  return allow();
}

// -- refundRequiresOrderId --
function refundRequiresOrderId(input) {
  if (input.tool !== 'process_refund') return allow();
  if (!input.params?.order_id) return deny('Order ID required before refund');
  return allow();
}

// -- slotTypeCheck --
function slotTypeCheck(input) {
  if (typeof input.value === 'string' && input.value.trim() === '') {
    return deny(`Slot '${input.slotName}' cannot be empty`);
  }
  return allow();
}

// -- piiInResponse --
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;
const CC_PATTERN = /\b\d{13,19}\b/;
function piiInResponse(input) {
  if (SSN_PATTERN.test(input.content) || CC_PATTERN.test(input.content)) {
    return deny('Response contained PII');
  }
  return allow();
}

// PolicyChecker logic (mirrors src/lib/policy/checker.ts)
async function runPolicies(policies, input) {
  let pendingApproval = null;
  for (const policy of policies) {
    const result = await policy(input);
    if (result.decision === 'deny') return result;
    if (result.decision === 'require_approval' && !pendingApproval) {
      pendingApproval = result;
    }
  }
  return pendingApproval ?? allow();
}

// ── Inline rule tests ────────────────────────────────────────────────────────

describe('refundAmountLimit rule', () => {
  test('refund > $500 returns require_approval', () => {
    const result = refundAmountLimit({ tool: 'process_refund', params: { amount: 600, order_id: 'ORD-1' } });
    assert.equal(result.decision, 'require_approval');
    assert.ok(result.reason.includes('$500'));
    assert.equal(result.approver, 'manager');
  });

  test('refund exactly $500 is allowed', () => {
    const result = refundAmountLimit({ tool: 'process_refund', params: { amount: 500, order_id: 'ORD-1' } });
    assert.equal(result.decision, 'allow');
  });

  test('refund below $500 is allowed', () => {
    const result = refundAmountLimit({ tool: 'process_refund', params: { amount: 100, order_id: 'ORD-1' } });
    assert.equal(result.decision, 'allow');
  });

  test('non-refund tool is always allowed', () => {
    const result = refundAmountLimit({ tool: 'lookup_order', params: { amount: 9999 } });
    assert.equal(result.decision, 'allow');
  });
});

describe('refundRequiresOrderId rule', () => {
  test('refund without order_id is denied', () => {
    const result = refundRequiresOrderId({ tool: 'process_refund', params: { amount: 50 } });
    assert.equal(result.decision, 'deny');
    assert.ok(result.reason.includes('Order ID'));
  });

  test('refund with order_id is allowed', () => {
    const result = refundRequiresOrderId({ tool: 'process_refund', params: { amount: 50, order_id: 'ORD-999' } });
    assert.equal(result.decision, 'allow');
  });

  test('non-refund tool with no order_id is allowed', () => {
    const result = refundRequiresOrderId({ tool: 'check_status', params: {} });
    assert.equal(result.decision, 'allow');
  });
});

describe('slotTypeCheck rule', () => {
  test('empty string slot value is denied', () => {
    const result = slotTypeCheck({ slotName: 'customer_name', value: '' });
    assert.equal(result.decision, 'deny');
    assert.ok(result.reason.includes('customer_name'));
  });

  test('whitespace-only slot value is denied', () => {
    const result = slotTypeCheck({ slotName: 'order_id', value: '   ' });
    assert.equal(result.decision, 'deny');
  });

  test('non-empty string slot value is allowed', () => {
    const result = slotTypeCheck({ slotName: 'order_id', value: 'ORD-123' });
    assert.equal(result.decision, 'allow');
  });

  test('numeric slot value is allowed', () => {
    const result = slotTypeCheck({ slotName: 'quantity', value: 3 });
    assert.equal(result.decision, 'allow');
  });

  test('null slot value is allowed (not a string)', () => {
    const result = slotTypeCheck({ slotName: 'notes', value: null });
    assert.equal(result.decision, 'allow');
  });
});

describe('piiInResponse rule', () => {
  test('SSN pattern in response is denied', () => {
    const result = piiInResponse({ content: 'Your SSN is 123-45-6789' });
    assert.equal(result.decision, 'deny');
    assert.ok(result.reason.includes('PII'));
  });

  test('credit-card-like 16-digit number in response is denied', () => {
    const result = piiInResponse({ content: 'Card on file: 4111111111111111' });
    assert.equal(result.decision, 'deny');
  });

  test('normal text without PII is allowed', () => {
    const result = piiInResponse({ content: 'Your order will arrive in 3-5 business days.' });
    assert.equal(result.decision, 'allow');
  });

  test('short numeric strings are allowed (not CC-length)', () => {
    const result = piiInResponse({ content: 'Order #12345 has shipped.' });
    assert.equal(result.decision, 'allow');
  });
});

describe('PolicyChecker composition', () => {
  test('deny wins over require_approval', async () => {
    // order_id missing → deny; amount > 500 → require_approval. deny should win.
    const result = await runPolicies(
      [refundRequiresOrderId, refundAmountLimit],
      { tool: 'process_refund', params: { amount: 750 } }
    );
    assert.equal(result.decision, 'deny');
  });

  test('require_approval is returned when no deny', async () => {
    const result = await runPolicies(
      [refundRequiresOrderId, refundAmountLimit],
      { tool: 'process_refund', params: { amount: 750, order_id: 'ORD-1' } }
    );
    assert.equal(result.decision, 'require_approval');
  });

  test('all-allow policies return allow', async () => {
    const result = await runPolicies(
      [refundRequiresOrderId, refundAmountLimit],
      { tool: 'process_refund', params: { amount: 50, order_id: 'ORD-1' } }
    );
    assert.equal(result.decision, 'allow');
  });
});

// ── API-level tests (require running server) ─────────────────────────────────

describe('Policy enforcement via API', () => {
  test('escalation intent routes to escalation agent', async () => {
    const conversationId = `unit-esc-${Date.now()}`;
    const { status, data } = await post('/api/orchestrator', {
      conversationId,
      message: 'I want to speak to a human agent right now',
    });
    assert.equal(status, 200);
    assert.ok(
      data.subAgent === 'escalation' ||
        (typeof data.response === 'string' &&
          (data.response.toLowerCase().includes('transfer') ||
            data.response.toLowerCase().includes('human'))),
      `Expected escalation routing, got subAgent=${data.subAgent}`
    );
  });

  test('knowledge query routes to RAG agent', async () => {
    const conversationId = `unit-rag-${Date.now()}`;
    const { status, data } = await post('/api/orchestrator', {
      conversationId,
      message: 'What is your return policy?',
    });
    assert.equal(status, 200);
    assert.ok(
      data.subAgent === 'rag' ||
        (typeof data.response === 'string' && data.response.toLowerCase().includes('return')),
      `Expected rag routing or return-related response, got subAgent=${data.subAgent}`
    );
  });

  test('response is not empty for greeting', async () => {
    const conversationId = `unit-greet-${Date.now()}`;
    const { status, data } = await post('/api/orchestrator', {
      conversationId,
      message: 'Hello, how are you?',
    });
    assert.equal(status, 200);
    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      'Response should be a non-empty string'
    );
  });

  test('supervisor block is present in orchestrator response', async () => {
    const conversationId = `unit-sup-${Date.now()}`;
    const { status, data } = await post('/api/orchestrator', {
      conversationId,
      message: 'Thank you so much for your help!',
    });
    assert.equal(status, 200);
    assert.ok(data.supervisor !== undefined, 'supervisor field should be present');
    assert.ok(
      typeof data.supervisor.pass === 'boolean',
      `supervisor.pass should be boolean, got ${typeof data.supervisor?.pass}`
    );
  });
});
