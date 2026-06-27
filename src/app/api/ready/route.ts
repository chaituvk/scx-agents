import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kubernetes readiness probe — returns 200 only when the process can serve traffic.
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json({ ready: false, reason: "database_unavailable" }, { status: 503 });
  }
}
