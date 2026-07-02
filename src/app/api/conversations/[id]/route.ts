import { NextRequest, NextResponse } from "next/server";
import { conversationRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { run } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await conversationRepo.findById(id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const body = await req.json();

  const allowed = ["status", "priority", "sentiment", "assigned_to", "topic"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i++}`);
      vals.push(body[key]);
    }
  }

  if (!sets.length) return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  sets.push(`updated_at = $${i++}`);
  vals.push(new Date().toISOString());
  vals.push(id, tenantId);

  const r = await run(
    `UPDATE conversations SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
    vals as string[]
  );

  if (!r.changes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await conversationRepo.findById(id);
  return NextResponse.json({ conversation: updated });
}
