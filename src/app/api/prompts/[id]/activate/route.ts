import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/tenant';
import { activatePromptVersion } from '@/lib/prompts';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = params;

    await activatePromptVersion(tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    const status = message === 'Prompt version not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
