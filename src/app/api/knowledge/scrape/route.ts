// Scrapes a URL and indexes its text content as a knowledge document.
// POST /api/knowledge/scrape  { url: string, sourceId?: string }

import { NextRequest, NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import { run } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { url, sourceId } = await req.json() as { url?: string; sourceId?: string };

    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KnowledgeScraper/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: HTTP ${res.status}` }, { status: 400 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text();

    const text = contentType.includes("html")
      ? extractTextFromHtml(rawText)
      : rawText;

    const chunks = chunkText(text, 500);
    const chunkCount = chunks.filter(c => c.trim()).length;
    const filename = `${parsed.hostname}${parsed.pathname}`.replace(/[^a-z0-9._-]/gi, "_").slice(0, 120) + ".txt";

    const docId = crypto.randomUUID();
    await run(
      `INSERT INTO knowledge_documents (id, tenant_id, source_id, filename, content_type, size_bytes, status, chunk_count)
       VALUES ($1, $2, $3, $4, 'text/plain', $5, 'indexed', $6)`,
      [docId, tenantId, sourceId ?? null, filename, Buffer.byteLength(text, "utf8"), chunkCount]
    );

    if (sourceId) {
      await run(
        `UPDATE knowledge_sources SET entries = entries + $1 WHERE id = $2`,
        [chunkCount, sourceId]
      );
    }

    return NextResponse.json({
      document: {
        id: docId,
        filename,
        content_type: "text/plain",
        size_bytes: Buffer.byteLength(text, "utf8"),
        chunk_count: chunkCount,
        status: "indexed",
        url,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[knowledge/scrape]", err);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}
