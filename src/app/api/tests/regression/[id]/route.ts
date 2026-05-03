import { NextRequest, NextResponse } from "next/server";
import { regressionTestRepo } from "@/lib/repositories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await regressionTestRepo.findById(id);
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ test });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await regressionTestRepo.update(id, {
      name: body.name,
      description: body.description,
      category: body.category,
      status: body.status,
      last_run: body.lastRun,
      duration: body.duration,
      error_message: body.errorMessage,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ test: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await regressionTestRepo.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
