import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { query, run } from "@/lib/db";

const ALLOWED_TONES = ["empathetic", "professional", "casual", "formal", "enthusiastic"] as const;
const SETTINGS_FIELDS = [
  "name",
  "slug",
  "primary_color",
  "accent_color",
  "welcome_message",
  "tone",
  "logo_url",
  "support_email",
  "timezone",
  "language",
  "max_tokens_per_turn",
  "inactivity_timeout_mins",
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "settings", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  try {
    const result = await query(
      `SELECT id, name, slug, primary_color, accent_color, welcome_message, tone,
              logo_url, support_email, timezone, language, max_tokens_per_turn, inactivity_timeout_mins
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ tenant: result.rows[0] });
  } catch (err) {
    console.error("[settings/tenant] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch tenant settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, "settings", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate tone if provided
  if (body.tone !== undefined && !ALLOWED_TONES.includes(body.tone as typeof ALLOWED_TONES[number])) {
    return NextResponse.json(
      { error: `tone must be one of: ${ALLOWED_TONES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate numeric fields
  if (body.max_tokens_per_turn !== undefined) {
    const v = Number(body.max_tokens_per_turn);
    if (!Number.isInteger(v) || v < 100 || v > 100000) {
      return NextResponse.json(
        { error: "max_tokens_per_turn must be an integer between 100 and 100000" },
        { status: 400 }
      );
    }
  }

  if (body.inactivity_timeout_mins !== undefined) {
    const v = Number(body.inactivity_timeout_mins);
    if (!Number.isInteger(v) || v < 1 || v > 1440) {
      return NextResponse.json(
        { error: "inactivity_timeout_mins must be an integer between 1 and 1440" },
        { status: 400 }
      );
    }
  }

  // Build dynamic UPDATE — only include fields that are present and allowed
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of SETTINGS_FIELDS) {
    if (field in body) {
      fields.push(`${field} = $${idx}`);
      values.push(body[field] ?? null);
      idx++;
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  fields.push(`updated_at = $${idx}`);
  values.push(new Date().toISOString());
  idx++;
  values.push(tenantId);

  try {
    await run(`UPDATE tenants SET ${fields.join(", ")} WHERE id = $${idx}`, values);

    const result = await query(
      `SELECT id, name, slug, primary_color, accent_color, welcome_message, tone,
              logo_url, support_email, timezone, language, max_tokens_per_turn, inactivity_timeout_mins
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    return NextResponse.json({ tenant: result.rows[0] });
  } catch (err) {
    console.error("[settings/tenant] PUT error:", err);
    return NextResponse.json({ error: "Failed to update tenant settings" }, { status: 500 });
  }
}
