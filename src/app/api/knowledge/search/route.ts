// Knowledge base semantic search endpoint.
// GET /api/knowledge/search?q=query&limit=5
// POST /api/knowledge/search { query, limit, test_mode }
//
// Allows operators to test knowledge retrieval directly from the Studio.
// Returns matching passages with relevance scores.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { retrieveKnowledge } from "@/lib/rag";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "knowledge", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "5"), 20);

  if (!q.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const passages = await retrieveKnowledge(q, limit, tenantId);
  return NextResponse.json({
    query: q,
    results: passages,
    count: passages.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "knowledge", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: { query?: string; limit?: number } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const q = body.query ?? "";
  const limit = Math.min(Number(body.limit ?? 5), 20);

  if (!q.trim()) {
    return NextResponse.json({ error: "Body field 'query' is required" }, { status: 400 });
  }

  const passages = await retrieveKnowledge(q, limit, tenantId);
  return NextResponse.json({
    query: q,
    results: passages,
    count: passages.length,
  });
}
