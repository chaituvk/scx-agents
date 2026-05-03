import { NextRequest, NextResponse } from "next/server";
import { generateJourneyFromText } from "@/lib/journey-generator";
import { journeyRepo } from "@/lib/repositories";

export async function POST(req: NextRequest) {
  try {
    const { description, sourceType } = await req.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const generated = await generateJourneyFromText(description);

    // Auto-save to database as draft
    const journey = await journeyRepo.create({
      name: generated.name,
      description: generated.description,
      status: "draft",
      nodes: generated.nodes,
      edges: generated.edges,
      variables: generated.variables.reduce((acc: Record<string, any>, v: string) => {
        acc[v] = "";
        return acc;
      }, {}),
    });

    return NextResponse.json({
      journey,
      generated,
      saved: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Generation failed", details: message }, { status: 500 });
  }
}
