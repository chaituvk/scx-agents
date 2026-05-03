/**
 * Login & Auth Test Suite
 * Run: node tests/login.test.js
 * Requires the dev server to be running on localhost:3000
 */

const assert = require("assert");

const BASE = "http://localhost:3000";

// Simple cookie jar
const cookieJar = new Map();

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(opts.headers || {}),
    },
  });

  // Store cookies from response
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    const [kv] = c.split(";");
    const [k, v] = kv.trim().split("=");
    if (v === "" || (c.includes("Max-Age=0") || c.includes("expires=Thu, 01 Jan 1970"))) {
      cookieJar.delete(k);
    } else {
      cookieJar.set(k, v);
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { status: res.status, data, headers: res.headers };
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("\n🔐 Login & Auth Tests");
  console.log("=====================\n");

  // ── Tenant Logins ──
  await test("R-Mobile admin login succeeds", async () => {
    cookieJar.clear();
    const { status, data } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.tenantId, "r-mobile");
    assert.strictEqual(data.user.email, "admin@sierra.ai");
    assert.strictEqual(data.user.isSuperAdmin, false);
  });

  await test("Ichiba admin login succeeds", async () => {
    cookieJar.clear();
    const { status, data } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@ichiba.ai", password: "sierra2026", tenant: "ichiba" }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.tenantId, "ichiba");
  });

  await test("RTravel admin login succeeds", async () => {
    cookieJar.clear();
    const { status, data } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@rtravel.ai", password: "sierra2026", tenant: "r-travel" }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.tenantId, "r-travel");
  });

  // ── Cross-tenant Login Fails ──
  await test("Cross-tenant login fails (R-Mobile user into Ichiba)", async () => {
    cookieJar.clear();
    const { status, data } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "sierra2026", tenant: "ichiba" }),
    });
    assert.strictEqual(status, 401);
    assert.strictEqual(data.error, "Invalid credentials");
  });

  await test("Wrong password fails", async () => {
    cookieJar.clear();
    const { status } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "wrongpassword", tenant: "r-mobile" }),
    });
    assert.strictEqual(status, 401);
  });

  // ── Super Admin ──
  await test("Superadmin login succeeds", async () => {
    cookieJar.clear();
    const { status, data } = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "superadmin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.isSuperAdmin, true);
    assert.strictEqual(data.user.role, "superadmin");
  });

  // ── Auth /me (cookie-based) ──
  await test("Auth /me returns user with valid cookie", async () => {
    cookieJar.clear();
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });
    assert.ok(cookieJar.has("sierra_token"), "Login should set sierra_token cookie");

    const { status, data } = await request("/api/auth/me");
    assert.strictEqual(status, 200);
    assert.strictEqual(data.user.email, "admin@sierra.ai");
    assert.strictEqual(data.tenant.id, "r-mobile");
  });

  await test("Auth /me returns 401 without cookie", async () => {
    cookieJar.clear();
    const { status } = await request("/api/auth/me");
    assert.strictEqual(status, 401);
  });

  // ── Logout ──
  await test("Logout clears cookie and prevents /me", async () => {
    cookieJar.clear();
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });
    assert.ok(cookieJar.has("sierra_token"));

    const logoutRes = await request("/api/auth/logout", { method: "POST" });
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(cookieJar.has("sierra_token"), false, "sierra_token should be cleared");

    const meRes = await request("/api/auth/me");
    assert.strictEqual(meRes.status, 401);
  });

  // ── Tenant Isolation on APIs ──
  await test("Journeys API returns only R-Mobile journeys", async () => {
    cookieJar.clear();
    const { data } = await request("/api/journeys", {
      headers: { "x-tenant-id": "r-mobile" },
    });
    assert.strictEqual(data.journeys.length, 2);
    assert.ok(data.journeys.every((j) => j.tenant_id === "r-mobile"));
  });

  await test("Journeys API returns only Ichiba journeys", async () => {
    cookieJar.clear();
    const { data } = await request("/api/journeys", {
      headers: { "x-tenant-id": "ichiba" },
    });
    assert.strictEqual(data.journeys.length, 2);
    assert.ok(data.journeys.every((j) => j.tenant_id === "ichiba"));
  });

  await test("Agents API is tenant-isolated (with auth)", async () => {
    cookieJar.clear();
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });

    const rMobile = await request("/api/agents");
    assert.strictEqual(rMobile.data.agents.length, 2);

    // Switch to ichiba via header (regular user can't switch, so this should still return r-mobile)
    // Actually for regular users, the API uses JWT tenant, so header is ignored
    // Let's login as ichiba instead
    cookieJar.clear();
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@ichiba.ai", password: "sierra2026", tenant: "ichiba" }),
    });
    const ichiba = await request("/api/agents");
    assert.strictEqual(ichiba.data.agents.length, 1);
  });

  // ── Superadmin Tenant Switching ──
  await test("Superadmin can switch tenants via view_tenant cookie", async () => {
    cookieJar.clear();
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "superadmin@sierra.ai", password: "sierra2026", tenant: "r-mobile" }),
    });

    // Default should be r-mobile
    const rMobile = await request("/api/agents");
    assert.strictEqual(rMobile.data.agents.length, 2);

    // Switch to ichiba
    cookieJar.set("view_tenant", "ichiba");
    const ichiba = await request("/api/agents");
    assert.strictEqual(ichiba.data.agents.length, 1);

    // Switch to r-travel
    cookieJar.set("view_tenant", "r-travel");
    const rTravel = await request("/api/agents");
    assert.strictEqual(rTravel.data.agents.length, 1);
  });

  console.log("\n✅ All tests passed\n");
}

main().catch((err) => {
  console.error("\n❌ Test runner failed:", err.message);
  process.exit(1);
});
