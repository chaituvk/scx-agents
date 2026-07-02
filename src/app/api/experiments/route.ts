import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/tenant';
import { query, run } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const result = await query(
      "SELECT * FROM experiments WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    const experiments = result.rows.map(r => ({
      ...r,
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : r.variants,
    }));
    return NextResponse.json({ experiments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();

    const { name, description, variants, metricGoal, status } = body;

    if (!name || !variants || !metricGoal) {
      return NextResponse.json(
        { error: 'name, variants, and metricGoal are required' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const experimentStatus = status ?? 'draft';

    await run(
      `INSERT INTO experiments (id, tenant_id, name, description, status, variants, metric_goal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, tenantId, name, description ?? null, experimentStatus, JSON.stringify(variants), metricGoal, now]
    );

    const experiment = {
      id,
      tenantId,
      name,
      description: description ?? null,
      status: experimentStatus,
      variants,
      metricGoal,
      createdAt: now,
    };

    return NextResponse.json({ experiment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
