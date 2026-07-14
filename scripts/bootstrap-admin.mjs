#!/usr/bin/env node
/**
 * Provision the first admin user with a REAL password — no hardcoded
 * credentials ever touch the database.
 *
 * Usage (env-driven):
 *   SUPABASE_DB_URL=postgresql://... \
 *   SEED_ADMIN_EMAIL=admin@yourco.com \
 *   SEED_ADMIN_PASSWORD='a-strong-password' \
 *   node scripts/bootstrap-admin.mjs
 *
 * Optional: SEED_ADMIN_NAME (default "Super Admin"),
 *           SEED_ADMIN_TENANT (default "r-mobile"),
 *           SEED_ADMIN_ROLE   (default "superadmin").
 *
 * Idempotent: re-running updates the password/name/role for that email.
 * Tip: load a dotenv file with Node's built-in flag:
 *   node --env-file=.env.local scripts/bootstrap-admin.mjs
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Super Admin";
const tenant = process.env.SEED_ADMIN_TENANT || "r-mobile";
const role = process.env.SEED_ADMIN_ROLE || "superadmin";

if (!url) fail("Set SUPABASE_DB_URL (or DATABASE_URL) to your Postgres connection string.");
if (!email || !password) fail("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
if (password.length < 10) fail("SEED_ADMIN_PASSWORD is too short — use at least 10 characters.");

// SSL: managed Postgres (Supabase/RDS/Cloud SQL) needs TLS, so it is the
// default. Local hosts and unix sockets skip it. Override with
// DB_SSL=disable (matches the app's provider config convention).
function resolveSsl() {
  const mode = (process.env.DB_SSL || "").toLowerCase();
  if (mode === "disable" || mode === "off" || mode === "false") return false;
  const isLocal =
    /@(localhost|127\.0\.0\.1|postgres)[:/]/.test(url) || /[?&]host=\/(tmp|var|run)/.test(url);
  if (isLocal && !mode) return false;
  return { rejectUnauthorized: mode === "strict" };
}

const pool = new Pool({
  connectionString: url,
  ssl: resolveSsl(),
  connectionTimeoutMillis: 8000,
});

try {
  const tenantRow = await pool.query("SELECT id FROM tenants WHERE id = $1", [tenant]);
  if (tenantRow.rowCount === 0) {
    fail(
      `Tenant "${tenant}" does not exist. Apply supabase/seed.sql first, ` +
        "or set SEED_ADMIN_TENANT to an existing tenant."
    );
  }

  const hash = bcrypt.hashSync(password, 10);
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, tenant_id, email, name, password, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, email)
       DO UPDATE SET password = EXCLUDED.password,
                     name = EXCLUDED.name,
                     role = EXCLUDED.role`,
    [id, tenant, email, name, hash, role]
  );

  console.log(`\n✓ Admin ready: ${email} (role=${role}, tenant=${tenant})`);
  console.log("  Password stored as a bcrypt hash. Log in at /login.\n");
} catch (err) {
  fail(`Failed to create admin: ${err.message}`);
} finally {
  await pool.end();
}
