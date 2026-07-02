import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/tenant';
import { createPromptVersion, listPromptVersions } from '@/lib/prompts';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get('agentType');

    if (!agentType) {
      return NextResponse.json(
        { error: 'agentType query parameter is required' },
        { status: 400 }
      );
    }

    const versions = await listPromptVersions(tenantId, agentType);
    return NextResponse.json({ versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();

    const { agentType, systemPrompt, notes } = body;

    if (!agentType || !systemPrompt) {
      return NextResponse.json(
        { error: 'agentType and systemPrompt are required' },
        { status: 400 }
      );
    }

    const version = await createPromptVersion(tenantId, agentType, systemPrompt, notes);
    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
