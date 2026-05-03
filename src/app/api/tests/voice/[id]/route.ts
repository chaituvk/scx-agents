import { NextRequest, NextResponse } from "next/server";
import { voiceSimRepo } from "@/lib/repositories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sim = await voiceSimRepo.findById(id);
  if (!sim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sim });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await voiceSimRepo.update(id, {
      name: body.name,
      noise_level: body.noiseLevel,
      speaker_type: body.speakerType,
      transcript: body.transcript,
      confidence: body.confidence,
      accuracy: body.accuracy,
      status: body.status,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sim: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await voiceSimRepo.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
