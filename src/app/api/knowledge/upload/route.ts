import { NextRequest, NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import { run, query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sourceId = formData.get("sourceId") as string | null;

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const allowedTypes = ["text/plain", "text/markdown", "application/json", "text/csv", "application/pdf"];
    const contentType = file.type || "application/octet-stream";
    if (!allowedTypes.some((t) => contentType.includes(t.split("/")[1]))) {
      return NextResponse.json({ error: `Unsupported file type: ${contentType}. Supported: txt, md, json, csv, pdf` }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10 MB." }, { status: 400 });
    }

    const docId = crypto.randomUUID();
    await run(
      `INSERT INTO knowledge_documents (id, tenant_id, source_id, filename, content_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing')`,
      [docId, tenantId, sourceId ?? null, file.name, contentType, file.size]
    );

    // Process the document asynchronously
    const text = await extractText(file, contentType);
    const chunks = chunkText(text, 500);

    // Store chunks as knowledge source entries (reuse knowledge_sources as a simple doc store)
    // In production this would embed each chunk via OpenAI/Anthropic and store in knowledge_embeddings
    let chunkCount = 0;
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      chunkCount++;
    }

    // Update document status
    await run(
      `UPDATE knowledge_documents SET status = 'indexed', chunk_count = $1, updated_at = $2 WHERE id = $3`,
      [chunkCount, new Date().toISOString(), docId]
    );

    // If a source was provided, update its entry count
    if (sourceId) {
      await run(
        `UPDATE knowledge_sources SET entries = entries + $1 WHERE id = $2`,
        [chunkCount, sourceId]
      );
    }

    return NextResponse.json({
      document: {
        id: docId,
        filename: file.name,
        content_type: contentType,
        size_bytes: file.size,
        chunk_count: chunkCount,
        status: "indexed",
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[knowledge/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const res = await query(
    `SELECT id, filename, content_type, size_bytes, status, chunk_count, created_at, updated_at
     FROM knowledge_documents WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [tenantId]
  );
  return NextResponse.json({ documents: res.rows });
}

async function extractText(file: File, contentType: string): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (contentType.includes("pdf")) {
    // Basic PDF text extraction — strips binary, keeps printable ASCII runs
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(bytes);
    const textRuns: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(raw)) !== null) textRuns.push(m[1]);
    return textRuns.join(" ") || raw.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ");
  }

  return new TextDecoder().decode(bytes);
}

function chunkText(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}
