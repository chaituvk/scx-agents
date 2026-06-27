// GET/PUT/DELETE /api/experiments/[id]
// GET /api/experiments/[id]?results=true — include per-variant outcome stats

import { NextRequest, NextResponse } from "next/server";
import { query, run } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const result = await query(
    "SELECT * FROM experiments WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const experiment = {
    ...result.rows[0],
    variants: typeof result.rows[0].variants === "string"
      ? JSON.parse(result.rows[0].variants as string)
      : result.rows[0].variants,
  };

  const { searchParams } = new URL(req.url);
  if (searchParams.get("results") !== "true") {
    return NextResponse.json({ experiment });
  }

  // Include per-variant outcome stats
  const statsResult = await query(
    `SELECT variant_id,
       COUNT(*) AS total_assigned,
       COUNT(*) FILTER (WHERE outcome = 'resolved') AS resolved,
       COUNT(*) FILTER (WHERE outcome = 'escalated') AS escalated,
       COUNT(*) FILTER (WHERE outcome = 'completed') AS completed
     FROM experiment_assignments
     WHERE experiment_id = $1
     GROUP BY variant_id`,
    [id]
  ).catch(() => ({ rows: [] }));

  const stats = statsResult.rows.map(r => ({
    variant_id: r.variant_id,
    total_assigned: Number(r.total_assigned),
    resolved: Number(r.resolved),
    escalated: Number(r.escalated),
    completed: Number(r.completed),
    completion_rate: Number(r.total_assigned) > 0 ? Number(r.completed) / Number(r.total_assigned) : 0,
    escalation_rate: Number(r.total_assigned) > 0 ? Number(r.escalated) / Number(r.total_assigned) : 0,
  }));

  return NextResponse.json({ experiment, variant_stats: stats });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const existing = await query("SELECT id FROM experiments WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (body.name) { sets.push(`name = $${idx++}`); vals.push(body.name); }
  if (body.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(body.description); }
  if (body.status) { sets.push(`status = $${idx++}`); vals.push(body.status); }
  if (body.variants) { sets.push(`variants = $${idx++}`); vals.push(JSON.stringify(body.variants)); }
  if (body.metric_goal) { sets.push(`metric_goal = $${idx++}`); vals.push(body.metric_goal); }
  if (body.status === "active") { sets.push(`started_at = $${idx++}`); vals.push(new Date().toISOString()); }
  if (body.status === "stopped" || body.status === "completed") { sets.push(`ended_at = $${idx++}`); vals.push(new Date().toISOString()); }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  vals.push(id);
  await run(`UPDATE experiments SET ${sets.join(", ")} WHERE id = $${idx}`, vals);

  const updated = await query("SELECT * FROM experiments WHERE id = $1", [id]);
  return NextResponse.json({
    experiment: {
      ...updated.rows[0],
      variants: typeof updated.rows[0].variants === "string"
        ? JSON.parse(updated.rows[0].variants as string)
        : updated.rows[0].variants,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const existing = await query("SELECT id FROM experiments WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  await run("DELETE FROM experiments WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
