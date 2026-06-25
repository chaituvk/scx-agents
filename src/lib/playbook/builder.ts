import type { Playbook, PlaybookRunContext } from './types'

/**
 * Build the system prompt for a playbook agent from the playbook definition
 * and injected knowledge documents. Pure function — no IO.
 */
export function buildSystemPrompt(
  playbook: Playbook,
  knowledge: PlaybookRunContext['knowledge'],
): string {
  const parts: string[] = []

  // Persona
  parts.push(playbook.persona)
  parts.push('')

  // What the agent handles
  parts.push('## What you handle')
  parts.push(playbook.description)
  parts.push('')

  // Step-by-step instructions
  if (playbook.instructions.length > 0) {
    parts.push('## Instructions')
    parts.push('Follow these steps in order:')
    playbook.instructions.forEach((instruction, i) => {
      parts.push(`${i + 1}. ${instruction}`)
    })
    parts.push('')
  }

  // Policies
  if (playbook.policies.length > 0) {
    parts.push('## Policies — you MUST follow these')
    for (const policy of playbook.policies) {
      const prefix = policy.severity === 'hard' ? '❌' : '⚠️'
      parts.push(`${prefix} ${policy.text}`)
    }
    parts.push('')
  }

  // Escalation triggers
  if (playbook.escalation_triggers.length > 0) {
    parts.push('## When to escalate to a human')
    parts.push('Use the escalate_to_human tool when:')
    for (const trigger of playbook.escalation_triggers) {
      parts.push(`- ${trigger}`)
    }
    parts.push('')
  }

  // Knowledge docs
  if (knowledge.length > 0) {
    parts.push('## Knowledge')
    for (const doc of knowledge) {
      parts.push(`### ${doc.title}`)
      parts.push(doc.content)
      parts.push('')
    }
  }

  // Tool use instructions
  parts.push('## Tool use')
  parts.push(
    'You have access to tools. Use them to help resolve customer issues.\n' +
    'Call escalate_to_human when you cannot resolve the issue within policy.\n' +
    'Always confirm actions with the customer before executing irreversible operations.',
  )

  return parts.join('\n')
}
