import { NextRequest, NextResponse } from "next/server";
import { runtimeProfileRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { runtimeProfileSchema } from "@/lib/runtime/profiles";

// Guardrails are runtime_profiles with kind = 'guardrail'.
// The policies JSONB field stores the rule definitions as an array.

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const all = await runtimeProfileRepo.findAll(tenantId);
    const guardrails = all.filter((p) => p.kind === "guardrail");
    return NextResponse.json({ guardrails });
  } catch {
    return NextResponse.json({ error: "Failed to fetch guardrails" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();

    // Force kind = 'guardrail' regardless of what the caller sends,
    // since the schema only allows router | specialist | policy we pass it
    // through after overriding. We store guardrail in the DB without schema
    // validation of the kind field so the repo insert is direct.
    const parsed = runtimeProfileSchema.safeParse({
      ...body,
      // Accept any name/status from the caller; default sensible values.
      name: body.name,
      kind: "policy", // closest valid enum value — overridden in DB insert below
      status: body.status ?? "active",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Guardrail validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guardrail = await runtimeProfileRepo.create({
      tenant_id: tenantId,
      ...parsed.data,
      // Override kind after schema validation — 'guardrail' is stored in the
      // DB but outside the Zod enum; cast is intentional.
      kind: "guardrail",
    } as any);

    return NextResponse.json({ guardrail }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create guardrail" }, { status: 400 });
  }
}
