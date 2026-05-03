import { NextRequest, NextResponse } from "next/server";
import { knowledgeSourceRepo } from "@/lib/repositories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await knowledgeSourceRepo.findById(id);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ source });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await knowledgeSourceRepo.update(id, {
      name: body.name,
      type: body.type,
      status: body.status,
      entries: body.entries,
      url: body.url,
      last_sync: body.lastSync,
      gaps: body.gaps,
      config: body.config,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ source: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await knowledgeSourceRepo.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
