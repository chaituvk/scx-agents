import { NextRequest, NextResponse } from "next/server";
import { journeyRepo } from "@/lib/repositories";
import { compileJourney } from "@/lib/journey/schema";

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
    const current = await journeyRepo.findById(id);
    if (!current) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const compiled = compileJourney({ ...current, ...body });
    if (!compiled.valid) {
      return NextResponse.json({
        error: "Journey validation failed",
        issues: compiled.errors,
        warnings: compiled.warnings,
      }, { status: 422 });
    }

    const normalized = compiled.normalized;
    const journey = await journeyRepo.update(id, {
      ...body,
      name: normalized.name,
      description: normalized.description,
      status: normalized.status,
      execution_mode: normalized.execution_mode,
      nodes: normalized.nodes,
      edges: normalized.edges,
      variables: normalized.variables,
      version: normalized.version,
    });
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    return NextResponse.json({ journey, validation: { warnings: compiled.warnings } });
  } catch {
    return NextResponse.json({ error: "Failed to update journey" }, { status: 400 });
  }
}
