/**
 * Seeds sample playbooks from test-data/tenants/<tenant>/playbooks.json into the database.
 *
 * Usage:
 *   npx tsx test-data/seed-playbooks.ts
 *   npx tsx test-data/seed-playbooks.ts --tenant r-mobile
 *   npx tsx test-data/seed-playbooks.ts --dry-run
 */

import fs from "fs";
import path from "path";
import { query, run } from "../src/lib/db";

const TENANTS = ["r-mobile", "ichiba", "r-travel"];

const args = process.argv.slice(2);
const tenantFilter = args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null;
const dryRun = args.includes("--dry-run");
const targetTenants = tenantFilter ? [tenantFilter] : TENANTS;

async function seedTenant(tenantId: string) {
  const file = path.join(__dirname, "tenants", tenantId, "playbooks.json");
  if (!fs.existsSync(file)) {
    console.warn(`  [skip] No playbooks.json found for tenant: ${tenantId}`);
    return;
  }

  const { playbooks } = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`\nSeeding ${playbooks.length} playbooks for tenant: ${tenantId}`);

  for (const pb of playbooks) {
    const existing = await query(
      "SELECT id FROM playbooks WHERE id = $1",
      [pb.id]
    );

    if (existing.rows.length > 0) {
      console.log(`  [skip] ${pb.name} — already exists (${pb.id})`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would insert: ${pb.name} (${pb.id})`);
      continue;
    }

    await run(
      `INSERT INTO playbooks
         (id, tenant_id, name, description, status, persona, topics, instructions,
          policies, actions, escalation_triggers, end_message, model_tier,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())`,
      [
        pb.id,
        pb.tenant_id,
        pb.name,
        pb.description,
        pb.status,
        pb.persona,
        JSON.stringify(pb.topics),
        JSON.stringify(pb.instructions),
        JSON.stringify(pb.policies),
        JSON.stringify(pb.actions),
        JSON.stringify(pb.escalation_triggers),
        pb.end_message ?? null,
        pb.model_tier ?? "large",
      ]
    );

    console.log(`  [ok] Inserted: ${pb.name} (${pb.id})`);
  }
}

async function main() {
  if (dryRun) console.log("DRY RUN — no changes will be written.\n");

  for (const tenantId of targetTenants) {
    await seedTenant(tenantId);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
