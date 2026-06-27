// Integration tests for new Sierra AI features:
// - Health/ready endpoints
// - CSAT submission + summary
// - Webhook CRUD
// - API key lifecycle
// - Conversation search + close + assign
// - Document upload
// - Conversation summary
//
// Run with: node --test tests/integration/new-features.test.mjs
// Requires: dev server running on http://localhost:3000

import { test, describe } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Grab a session cookie from the seeded admin user
async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@r-mobile.com", password: "admin123" }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/sierra_token=([^;]+)/);
  return match ? `sierra_token=${match[1]}` : "";
}

async function authed(cookie, path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Cookie: cookie, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
}

describe("Health endpoints", () => {
  test("/api/health returns 200", async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(["healthy", "degraded"].includes(body.status));
    assert.ok(body.checks?.database);
  });

  test("/api/ready returns 200", async () => {
    const res = await fetch(`${BASE}/api/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ready, true);
  });
});

describe("CSAT", () => {
  test("Submit and read CSAT rating", async () => {
    const cookie = await login();
    const convId = `test-csat-conv-${Date.now()}`;

    // Create conversation via orchestrator
    const orchRes = await authed(cookie, "/api/orchestrator", {
      method: "POST",
      body: JSON.stringify({ conversationId: convId, message: "Hello", tenantId: "r-mobile" }),
    });
    assert.equal(orchRes.status, 200);

    // Close conversation
    const closeRes = await authed(cookie, `/api/conversations/${convId}/close`, { method: "POST", body: "{}" });
    assert.equal(closeRes.status, 200);

    // Submit CSAT
    const csatRes = await fetch(`${BASE}/api/csat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId, score: 5, comment: "Great help!" }),
    });
    assert.equal(csatRes.status, 201);
    const csatData = await csatRes.json();
    assert.equal(csatData.rating.score, 5);

    // Get CSAT summary
    const summaryRes = await authed(cookie, "/api/csat");
    assert.equal(summaryRes.status, 200);
    const summary = await summaryRes.json();
    assert.ok(summary.summary.total_ratings >= 1);
  });
});

describe("Webhooks", () => {
  let webhookId;

  test("Create webhook", async () => {
    const cookie = await login();
    const res = await authed(cookie, "/api/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: "https://httpbin.org/post", description: "Test webhook" }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.webhook.id);
    assert.ok(data.webhook.secret); // secret only returned on creation
    webhookId = data.webhook.id;
  });

  test("List webhooks", async () => {
    const cookie = await login();
    const res = await authed(cookie, "/api/webhooks");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.webhooks));
  });

  test("Update webhook status", async () => {
    if (!webhookId) return;
    const cookie = await login();
    const res = await authed(cookie, `/api/webhooks/${webhookId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "disabled" }),
    });
    assert.equal(res.status, 200);
  });

  test("Delete webhook", async () => {
    if (!webhookId) return;
    const cookie = await login();
    const res = await authed(cookie, `/api/webhooks/${webhookId}`, { method: "DELETE", body: "" });
    assert.equal(res.status, 204);
  });
});

describe("API Keys", () => {
  let keyId;

  test("Create API key", async () => {
    const cookie = await login();
    const res = await authed(cookie, "/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Test Key", scopes: ["read"] }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.key.plaintext?.startsWith("sk_"));
    keyId = data.key.id;
  });

  test("List API keys (no plaintext)", async () => {
    const cookie = await login();
    const res = await authed(cookie, "/api/api-keys");
    assert.equal(res.status, 200);
    const data = await res.json();
    for (const k of data.keys) {
      assert.ok(!k.plaintext, "plaintext should not be exposed in list");
    }
  });

  test("Revoke API key", async () => {
    if (!keyId) return;
    const cookie = await login();
    const res = await authed(cookie, `/api/api-keys/${keyId}`, { method: "DELETE", body: "" });
    assert.equal(res.status, 204);
  });
});

describe("Conversation search and lifecycle", () => {
  test("Search conversations", async () => {
    const cookie = await login();
    const res = await authed(cookie, "/api/conversations/search?status=open&limit=10");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.conversations));
    assert.ok(typeof data.total === "number");
  });

  test("Assign conversation", async () => {
    const cookie = await login();
    const convId = `test-assign-${Date.now()}`;

    await authed(cookie, "/api/orchestrator", {
      method: "POST",
      body: JSON.stringify({ conversationId: convId, message: "Help me", tenantId: "r-mobile" }),
    });

    const res = await authed(cookie, `/api/conversations/${convId}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId: "agent-1" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assigned_to, "agent-1");
  });
});

describe("OpenAPI spec", () => {
  test("GET /api/openapi returns valid spec", async () => {
    const res = await fetch(`${BASE}/api/openapi`);
    assert.equal(res.status, 200);
    const spec = await res.json();
    assert.equal(spec.openapi, "3.1.0");
    assert.ok(spec.paths["/orchestrator"]);
    assert.ok(spec.paths["/webhooks"]);
    assert.ok(spec.paths["/api-keys"]);
  });
});
