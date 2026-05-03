import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));
  try {
    const tenantId = req.headers.get("x-tenant-id") || "r-mobile";
    const journeys = await journeyRepo.findByTenant(tenantId);
    return NextResponse.json({ journeys }, { headers });
  } catch {
    return NextResponse.json({ journeys: [] }, { status: 500, headers });
  }
}
