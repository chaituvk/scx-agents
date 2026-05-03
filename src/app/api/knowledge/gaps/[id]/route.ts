import { NextRequest, NextResponse } from "next/server";
import { knowledgeGapRepo } from "@/lib/repositories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gap = await knowledgeGapRepo.findById(id);
  if (!gap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ gap });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await knowledgeGapRepo.update(id, {
      question: body.question,
      frequency: body.frequency,
      status: body.status,
      suggested_answer: body.suggestedAnswer,
      source_ids: body.sourceIds,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ gap: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await knowledgeGapRepo.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
