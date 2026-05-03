import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const journey = await journeyRepo.findById(id);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    return NextResponse.json({ journey });
  } catch {
    return NextResponse.json({ error: "Failed to fetch journey" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const journey = await journeyRepo.update(id, body);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    return NextResponse.json({ journey });
  } catch {
    return NextResponse.json({ error: "Failed to update journey" }, { status: 400 });
  }
}
