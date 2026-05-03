import { NextRequest, NextResponse } from "next/server";
import { voiceSimRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const sims = await voiceSimRepo.findAll(tenantId);
  return NextResponse.json({ sims });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const sim = await voiceSimRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Voice Sim",
      noise_level: body.noiseLevel || "quiet",
      speaker_type: body.speakerType || "native",
      transcript: body.transcript || "",
      confidence: body.confidence ?? null,
      accuracy: body.accuracy ?? null,
      status: body.status || "pending",
    });
    return NextResponse.json({ sim }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create sim" }, { status: 400 });
  }
}
