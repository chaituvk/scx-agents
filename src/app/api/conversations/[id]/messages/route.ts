import { NextRequest, NextResponse } from "next/server";
import { messageRepo } from "@/lib/repositories";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await messageRepo.findByConversation(id);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 400 });
  }
}
