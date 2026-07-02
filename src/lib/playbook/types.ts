export interface PlaybookPolicy {
  text: string
  severity: 'hard' | 'soft'  // hard = immediate fallback, soft = flag and continue
}

export interface Playbook {
  id: string
  tenant_id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'archived'

  // LLM persona — who is this agent?
  persona: string

  // Natural language topics this playbook handles (used by triage for routing)
  topics: string[]

  // Step-by-step natural language instructions
  instructions: string[]

  // Hard and soft rules
  policies: PlaybookPolicy[]

  // Tool names from the tool registry this agent may call
  actions: string[]

  // Natural language descriptions of when to escalate to a human
  escalation_triggers: string[]

  // Optional closing behavior
  end_message?: string

  // Model tier override
  model_tier?: 'small' | 'reasoning' | 'large'

  created_at?: string
  updated_at?: string
}

export interface PlaybookRunContext {
  conversationId: string
  tenantId: string
  customerId?: string
  message: string
  history: Array<{ role: string; content: string }>
  knowledge: Array<{ title: string; content: string; source: string }>
  variables: Record<string, string>
  /** Injected by orchestrator when the customer is communicating in a non-English language. */
  languageInstruction?: string
}

export interface PlaybookToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: unknown
}

export interface PlaybookRunOutput {
  response: string
  toolCalls: PlaybookToolCall[]
  variables: Record<string, string>
  done: boolean
  escalated: boolean
  escalationReason?: string
  /** Set when runner hits request_approval — caller should persist and pause */
  pendingApproval?: { reason: string; action: string }
  thinkingSteps: string[]
}
