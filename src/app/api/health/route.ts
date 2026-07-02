import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: "ok" | "degraded" | "down"; latency_ms?: number }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await query("SELECT 1");
    checks.database = { status: "ok", latency_ms: Date.now() - dbStart };
  } catch {
    checks.database = { status: "down", latency_ms: Date.now() - dbStart };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyDown = Object.values(checks).some((c) => c.status === "down");

  return NextResponse.json(
    {
      status: anyDown ? "unhealthy" : allOk ? "healthy" : "degraded",
      version: process.env.npm_package_version ?? "0.0.0",
      ts: new Date().toISOString(),
      checks,
    },
    { status: anyDown ? 503 : 200 }
  );
}
