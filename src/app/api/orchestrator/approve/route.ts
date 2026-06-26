// Approval resume endpoint (Stage 7).
//
// Clears the pending_approval lock on a conversation and re-enters the
// orchestrator with a hint-driven turn so the journey advances past the
// paused policy_check node. Approvers post a decision; the response is
// the resumed turn's output (or a structured rejection if the approver
// said "reject").
//
// Auth: trust-based for now — caller must supply approverId. A real
// deployment would gate this behind supervisor auth/RBAC; the audit
// trail records approverId for review.

import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { getTenantFromRequest } from "@/lib/tenant";
import { dialogStateRepo } from "@/lib/repositories";
import { makeAuditEmitter } from "@/lib/audit";
import type { PendingApproval } from "@/lib/agents/types";

interface ApproveBody {
  conversationId?: string;
  decision?: "approve" | "reject";
  approverId?: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ApproveBody;
    const { conversationId, decision, approverId, note } = body;

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
    }
    if (!approverId || typeof approverId !== "string") {
      return NextResponse.json({ error: "approverId required" }, { status: 400 });
    }

    const tenantId = await getTenantFromRequest(req);
    const audit = makeAuditEmitter(conversationId, tenantId);

    const state = await dialogStateRepo.findByConversationForTenant(conversationId, tenantId);
    if (!state || !state.pending_approval) {
      return NextResponse.json({ error: "no pending approval for this conversation" }, { status: 404 });
    }
    const pending = state.pending_approval as unknown as PendingApproval;

    // Clear the lock and stamp the approver's decision into the variables
    // so condition edges off the policy_check node can branch on it.
    const variables = { ...((state.variables as Record<string, string> | undefined) ?? {}) };
    delete variables.approval_required;
    if (decision === "approve") {
      variables.approval_granted = "true";
      delete variables.approval_denied;
    } else {
      variables.approval_denied = "true";
      delete variables.approval_granted;
    }

    await dialogStateRepo.upsertByConversationForTenant(tenantId, conversationId, {
      variables,
      pending_approval: null,
    });

    await audit.emit("approval_decision", {
      decision,
      approverId,
      note,
      pendingApprovalId: pending.id,
      journeyId: pending.journeyId,
      nodeId: pending.nodeId,
    });

    if (decision === "reject") {
      // No resume — the conversation stays parked at the policy_check node
      // with approval_denied=true. The next user turn will re-enter the
      // workflow-agent, advance via a condition edge if the journey
      // branches on approval_denied, or land on a fallback.
      return NextResponse.json({
        status: "rejected",
        approverId,
        pendingApprovalId: pending.id,
        journeyId: pending.journeyId,
        nodeId: pending.nodeId,
      });
    }

    // Approve path: drive a synthetic resume turn through the orchestrator.
    // Route to the sub-agent that originally paused (workflow or playbook).
    // forceSubAgent bypasses the pending-approval gate (cleared above) and
    // re-enters the correct engine at the paused position.
    const isPlaybook = pending.subAgent === "playbook";
    const resumed = await orchestrator.runTurn({
      conversationId,
      tenantId,
      message: "[approval granted]",
      forceSubAgent: isPlaybook ? "playbook" : "workflow",
      ...(!isPlaybook && pending.journeyId ? { requestedJourneyId: pending.journeyId } : {}),
      variables,
    });

    return NextResponse.json({
      status: "approved",
      approverId,
      pendingApprovalId: pending.id,
      resumed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
