// PlaybookAgent — Sierra AI-inspired playbook-driven sub-agent.
//
// Multi-turn state: variables are persisted to playbook_states between turns
// so the LLM never needs to re-ask for information already provided. The
// conversation history (loaded via memory layer) tells the LLM where the
// conversation is — no explicit node pointer needed.

import { runPlaybook } from '../playbook'
import type { Playbook, PlaybookRunContext } from '../playbook'
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
} from './types'

// ── Playbook loading ──────────────────────────────────────────────────

async function loadPlaybook(
  tenantId: string,
  triage: TriageOutput & { playbookId?: string },
): Promise<Playbook | null> {
  try {
    const { playbookRepo } = await import('../repositories/playbook')
    if (triage.playbookId) {
      const found = await playbookRepo.findById(triage.playbookId)
      if (found) return found as unknown as Playbook
    }
    const all = await playbookRepo.findAll(tenantId)
    const active = all.find((p) => p.status === 'active')
    return active ? (active as unknown as Playbook) : null
  } catch {
    return null
  }
}

// ── State persistence ─────────────────────────────────────────────────

async function loadPriorVariables(
  conversationId: string,
  tenantId: string,
  playbookId: string,
): Promise<{ variables: Record<string, string>; turnCount: number }> {
  try {
    const { playbookStateRepo } = await import('../repositories/playbook-state')
    const state = await playbookStateRepo.load(conversationId, tenantId)
    // Only restore state if it belongs to the same playbook
    if (state && state.playbook_id === playbookId) {
      return { variables: state.variables, turnCount: state.turn_count }
    }
  } catch {
    // state repo not ready — fresh start
  }
  return { variables: {}, turnCount: 0 }
}

async function persistState(
  conversationId: string,
  tenantId: string,
  playbookId: string,
  variables: Record<string, string>,
  turnCount: number,
): Promise<void> {
  try {
    const { playbookStateRepo } = await import('../repositories/playbook-state')
    await playbookStateRepo.upsert({ conversation_id: conversationId, tenant_id: tenantId, playbook_id: playbookId, variables, turn_count: turnCount })
  } catch (err) {
    console.error('[playbookAgent] state persistence failed:', err)
  }
}

// ── Agent ─────────────────────────────────────────────────────────────

export const playbookAgent: SubAgent = {
  name: 'playbook' as SubAgent['name'],

  canHandle(triage: TriageOutput): boolean {
    return (triage.subAgent as string) === 'playbook'
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    const triage = input.triage as TriageOutput & { playbookId?: string }
    const playbook = await loadPlaybook(ctx.tenantId, triage)

    if (!playbook) {
      return {
        response: "I'm sorry, I don't have a playbook configured for this topic yet. Let me connect you with a human agent.",
        variables: input.variables,
        done: true,
        actions: [{ type: 'transfer', payload: { reason: 'No active playbook found for tenant' } }],
      }
    }

    // Load variables collected in prior turns for this conversation.
    // Merge order: persisted (prior turns) → input.variables (this turn's
    // pre-loaded slots from orchestrator) so orchestrator-injected values win.
    const { variables: priorVars, turnCount } = await loadPriorVariables(
      ctx.conversationId, ctx.tenantId, playbook.id
    )
    const mergedVariables: Record<string, string> = { ...priorVars, ...input.variables }

    const runContext: PlaybookRunContext = {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      customerId: input.context.profile?.id,
      message: input.message,
      history: input.context.history.map((h) => ({ role: h.role, content: h.content })),
      knowledge: input.context.knowledge.map((k) => ({ title: k.title, content: k.content, source: k.source })),
      variables: mergedVariables,
      languageInstruction: input.context.languageInstruction,
    }

    const output = await runPlaybook(playbook, runContext)

    // Persist or clean up state depending on conversation outcome.
    // When done, delete the row so the next conversation starts fresh.
    if (output.done && !output.pendingApproval) {
      try {
        const { playbookStateRepo } = await import('../repositories/playbook-state')
        await playbookStateRepo.delete(ctx.conversationId, ctx.tenantId)
      } catch { /* non-fatal */ }
    } else {
      await persistState(ctx.conversationId, ctx.tenantId, playbook.id, output.variables, turnCount + 1)
    }

    // Audit tool calls
    for (const tc of output.toolCalls) {
      if (tc.name === 'set_variable' || tc.name === 'get_variable') continue // internal — no audit noise
      await ctx.audit.emit('tool_call', {
        tool: tc.name, input: tc.input, result: tc.result, callId: tc.id, playbookId: playbook.id,
      })
    }

    const actions: SubAgentRunOutput['actions'] = []

    // Handle pending approval pause
    if (output.pendingApproval) {
      await ctx.audit.emit('policy_event', {
        decision: 'require_approval',
        target: `playbook:${playbook.id}`,
        reason: output.pendingApproval.reason,
      })
      return {
        response: output.response,
        variables: output.variables,
        done: false,
        actions: [],
        pendingAction: {
          id: `pending-${ctx.conversationId}-${turnCount + 1}`,
          tool: output.pendingApproval.action,
          params: output.pendingApproval as unknown as Record<string, unknown>,
        },
      }
    }

    if (output.escalated) {
      await ctx.audit.emit('escalation_handoff', {
        reason: output.escalationReason ?? 'Playbook escalation',
        playbookId: playbook.id,
        conversationId: ctx.conversationId,
      })
      actions.push({ type: 'transfer', payload: { reason: output.escalationReason ?? 'Playbook escalation' } })
    }

    return {
      response: output.response,
      variables: output.variables,
      done: output.done,
      actions,
      toolCalls: output.toolCalls.map((tc) => ({ tool: tc.name, params: tc.input, result: tc.result })),
    }
  },
}
