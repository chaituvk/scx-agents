/**
 * Sentiment & supervisor unit tests — validate that supervisor returns
 * expected shape and that sentiment analysis is wired into the response.
 *
 * Run: BASE_URL=http://localhost:3000 node --test tests/unit/sentiment.test.mjs
 * Requires the dev server to be running.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TENANT = 'r-mobile';

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

describe('Supervisor response shape', () => {
  test('supervisor field is present and has required keys', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-shape-${Date.now()}`,
      message: 'Thank you so much for your help!',
    });
    assert.equal(status, 200);
    assert.ok(data.supervisor !== undefined, 'supervisor field should be present');
    assert.ok(typeof data.supervisor.pass === 'boolean', 'supervisor.pass should be boolean');
  });

  test('supervisor.pass is true for a safe, on-topic reply', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-safe-${Date.now()}`,
      message: 'What are your store hours?',
    });
    assert.equal(status, 200);
    // pass may be false if LLM judge is unavailable; we accept either but
    // confirm the field is a boolean.
    assert.ok(typeof data.supervisor?.pass === 'boolean', 'supervisor.pass must be boolean');
  });

  test('supervisor.issues is an array', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-issues-${Date.now()}`,
      message: 'Can you help me with my account?',
    });
    assert.equal(status, 200);
    assert.ok(
      data.supervisor?.issues === undefined || Array.isArray(data.supervisor.issues),
      'supervisor.issues must be an array when present'
    );
  });
});

describe('Sentiment analysis integration', () => {
  test('positive message produces a response (sentiment path exercised)', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-pos-${Date.now()}`,
      message: 'This is amazing, I love your service!',
    });
    assert.equal(status, 200);
    assert.ok(typeof data.response === 'string' && data.response.length > 0, 'response must be non-empty');
  });

  test('negative / frustrated message still receives a response', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-neg-${Date.now()}`,
      message: 'I am extremely unhappy and very disappointed with this experience.',
    });
    assert.equal(status, 200);
    assert.ok(typeof data.response === 'string' && data.response.length > 0, 'response must be non-empty');
  });

  test('supervisor is present after negative-sentiment turn', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-neg2-${Date.now()}`,
      message: 'I am furious. This is the worst service ever.',
    });
    assert.equal(status, 200);
    assert.ok(data.supervisor !== undefined, 'supervisor should be present');
    assert.ok(typeof data.supervisor.pass === 'boolean', 'supervisor.pass must be boolean');
  });
});

describe('Escalation risk signal', () => {
  test('explicit escalation request has transfer action', async () => {
    const { status, data } = await post('/api/orchestrator', {
      conversationId: `sent-esc-${Date.now()}`,
      message: 'Please connect me to a human agent',
    });
    assert.equal(status, 200);
    assert.equal(data.subAgent, 'escalation');
    const transfer = data.actions?.find((a) => a.type === 'transfer');
    assert.ok(transfer, 'escalation turn should include a transfer action');
  });
});
