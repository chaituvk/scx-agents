import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { userRepo } from '@/lib/repositories';

async function getAuthenticatedUser(req: NextRequest) {
  const token = req.cookies.get('sierra_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payload;
}

// GET /api/privacy/export — export all data for a user
export async function GET(req: NextRequest) {
  const payload = await getAuthenticatedUser(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, email, tenantId } = payload;

  // Collect all data for the authenticated user
  const [messagesResult, conversationsResult, dialogStatesResult, auditResult] = await Promise.all([
    // Messages authored by the user's conversations (matched by customer_email)
    query(
      `SELECT m.* FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.customer_email = $1 AND m.tenant_id = $2
       ORDER BY m.created_at ASC`,
      [email, tenantId]
    ),
    // Conversation metadata
    query(
      `SELECT * FROM conversations WHERE customer_email = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      [email, tenantId]
    ),
    // Dialog states linked to those conversations
    query(
      `SELECT ds.* FROM dialog_states ds
       JOIN conversations c ON ds.conversation_id = c.id
       WHERE c.customer_email = $1 AND ds.tenant_id = $2`,
      [email, tenantId]
    ),
    // Audit events summary — count only, no PII payload
    query(
      `SELECT ae.type, COUNT(*) as count
       FROM audit_events ae
       JOIN conversations c ON ae.conversation_id = c.id
       WHERE c.customer_email = $1 AND ae.tenant_id = $2
       GROUP BY ae.type`,
      [email, tenantId]
    ),
  ]);

  // Fetch user profile (without password)
  const user = await userRepo.findById(userId);
  const userProfile = user
    ? { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id, created_at: user.created_at }
    : null;

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user: userProfile,
    conversations: conversationsResult.rows,
    messages: messagesResult.rows,
    dialogStates: dialogStatesResult.rows,
    auditEventsSummary: auditResult.rows,
  });
}

// DELETE /api/privacy/delete — delete all PII for a user
export async function DELETE(req: NextRequest) {
  const payload = await getAuthenticatedUser(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow the user themselves or a superadmin
  const isSuperAdmin = payload.isSuperAdmin;

  // Determine which user to delete
  let targetEmail: string;
  let targetUserId: string;

  if (isSuperAdmin) {
    // Superadmin may specify a target via query param
    const emailParam = req.nextUrl.searchParams.get('email');
    const userIdParam = req.nextUrl.searchParams.get('userId');
    if (emailParam) {
      const targetUser = await userRepo.findByEmail(emailParam);
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      targetEmail = targetUser.email;
      targetUserId = targetUser.id;
    } else if (userIdParam) {
      const targetUser = await userRepo.findById(userIdParam);
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      targetEmail = targetUser.email;
      targetUserId = targetUser.id;
    } else {
      // Default to themselves
      targetEmail = payload.email;
      targetUserId = payload.userId;
    }
  } else {
    targetEmail = payload.email;
    targetUserId = payload.userId;
  }

  // Delete all messages where conversation belongs to the user (matched by customer_email)
  await run(
    `DELETE FROM messages WHERE conversation_id IN (
       SELECT id FROM conversations WHERE customer_email = $1
     )`,
    [targetEmail]
  );

  // Anonymize conversations
  await run(
    `UPDATE conversations SET customer_name = $1, customer_email = $2 WHERE customer_email = $3`,
    ['DELETED', 'deleted@privacy.local', targetEmail]
  );

  // Remove user record
  await userRepo.delete(targetUserId);

  return NextResponse.json({
    success: true,
    deletedAt: new Date().toISOString(),
    message: 'All personal data has been deleted and conversations anonymized.',
  });
}

// POST /api/privacy/ccpa-optout — CCPA opt-out
export async function POST(req: NextRequest) {
  const payload = await getAuthenticatedUser(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Update the user record to set ccpa_opt_out flag.
  // The column is added via ALTER TABLE migration in db.ts (see Issue #18 migration block).
  await run(
    `UPDATE users SET ccpa_opt_out = $1 WHERE id = $2`,
    [true, payload.userId]
  );

  return NextResponse.json({
    success: true,
    optedOutAt: new Date().toISOString(),
    message: 'CCPA opt-out recorded. Your data will not be sold or shared with third parties.',
  });
}
