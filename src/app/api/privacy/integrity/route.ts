import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { auditEventRepo } from '@/lib/repositories/audit-event';

// GET /api/privacy/integrity — verify audit log integrity for a conversation
// Query param: conversationId
// Returns: { valid: boolean, events: number, firstBroken?: string }
export async function GET(req: NextRequest) {
  const token = req.cookies.get('sierra_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json(
      { error: 'conversationId query parameter is required' },
      { status: 400 }
    );
  }

  const result = await auditEventRepo.verifyIntegrity(conversationId);

  return NextResponse.json(result);
}
