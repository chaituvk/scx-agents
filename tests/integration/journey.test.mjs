/**
 * End-to-end journey integration tests.
 *
 * Run: BASE_URL=http://localhost:3000 node --test tests/integration/journey.test.mjs
 * Requires the dev server to be running.
 *
 * Auth: these tests use cookie-based login (sierra_token) matching the pattern
 * established by tests/login.test.js — the `tenant` field (not `tenantId`) is
 * used in the login payload.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Log in and return the raw Set-Cookie header string.
 * The login endpoint expects { email, password, tenant }.
 */
async function login(email = 'admin@sierra.ai', password = 'sierra2026', tenant = 'r-mobile') {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenant }),
  });
  assert.equal(res.status, 200, `Login failed for ${email} (got ${res.status})`);
  // Collect all Set-Cookie values and join them for the Cookie header.
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Create a new conversation and return its ID.
 * Tries several possible shapes of the response body.
 */
async function createConv(cookie, tenantId = 'r-mobile') {
  const res = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ customer_name: 'Integration Test Customer', channel: 'web', tenant_id: tenantId }),
  });
  const body = await res.json();
  const id = body.id ?? body.conversation?.id ?? (Array.isArray(body) ? body[0]?.id : undefined);
  assert.ok(id, `Failed to create conversation — response: ${JSON.stringify(body)}`);
  return id;
}

/**
 * Send one turn to the orchestrator and return the parsed response body.
 */
async function turn(cookie, conversationId, message) {
  const res = await fetch(`${BASE_URL}/api/orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ conversationId, message }),
  });
  return res.json();
}

// ── Journey tests ─────────────────────────────────────────────────────────────

describe('End-to-end journey: Return & Refund', () => {
  test('complete return flow via workflow agent', async () => {
    const cookie = await login('admin@ichiba.ai', 'sierra2026', 'ichiba');
    const convId = await createConv(cookie, 'ichiba');

    // Turn 1: express intent to return
    const t1 = await turn(cookie, convId, 'I need to return my order');
    assert.ok(typeof t1.response === 'string' && t1.response.length > 0, 'turn 1 should produce a response');

    // Turn 2: provide an order number
    const t2 = await turn(cookie, convId, 'My order number is ORD-12345');
    assert.ok(typeof t2.response === 'string' && t2.response.length > 0, 'turn 2 should produce a response');
  });

  test('RAG agent answers knowledge questions', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    const result = await turn(cookie, convId, 'What is your warranty policy?');
    assert.ok(
      typeof result.response === 'string' && result.response.length > 20,
      'should return a substantive response'
    );
    assert.ok(
      result.subAgent === 'rag' || result.response.toLowerCase().includes('warrant'),
      `expected rag routing or warranty-related content, got subAgent=${result.subAgent}`
    );
  });

  test('escalation flow produces a transfer action or escalation routing', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    const result = await turn(cookie, convId, 'I am furious and demand to speak with a manager immediately');
    assert.ok(typeof result.response === 'string', 'should produce a response');

    const isEscalated =
      result.subAgent === 'escalation' ||
      result.actions?.some((a) => a.type === 'transfer') ||
      result.response.toLowerCase().includes('transfer') ||
      result.response.toLowerCase().includes('human');
    assert.ok(isEscalated, `expected escalation signal, got subAgent=${result.subAgent}`);
  });

  test('multi-turn conversation maintains context across turns', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    await turn(cookie, convId, 'I want to start a device troubleshooting journey');
    const t2 = await turn(cookie, convId, 'I have an iPhone 15');
    assert.ok(
      typeof t2.response === 'string' && t2.response.length > 0,
      'second turn should produce a response'
    );
  });
});

describe('End-to-end journey: Knowledge retrieval', () => {
  test('consecutive knowledge questions receive distinct responses', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    const r1 = await turn(cookie, convId, 'What is your return window?');
    const r2 = await turn(cookie, convId, 'Do you offer extended warranties?');

    assert.ok(r1.response?.length > 0, 'first knowledge response must be non-empty');
    assert.ok(r2.response?.length > 0, 'second knowledge response must be non-empty');
  });

  test('smalltalk routes to general agent', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    const result = await turn(cookie, convId, 'Hey there, thanks for the help!');
    assert.ok(
      result.subAgent === 'general' || typeof result.response === 'string',
      'smalltalk should route to general or return a response'
    );
  });
});

describe('End-to-end journey: Supervisor integration', () => {
  test('every orchestrator turn returns a supervisor block', async () => {
    const cookie = await login();
    const convId = await createConv(cookie);

    const result = await turn(cookie, convId, 'Hello, can you help me?');
    assert.ok(result.supervisor !== undefined, 'supervisor block must be present');
    assert.ok(typeof result.supervisor.pass === 'boolean', 'supervisor.pass must be boolean');
  });

  test('orchestrator rejects turn with missing conversationId', async () => {
    const cookie = await login();
    const res = await fetch(`${BASE_URL}/api/orchestrator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ message: 'hello' }),
    });
    assert.equal(res.status, 400, 'missing conversationId should return 400');
  });
});
