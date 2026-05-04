# Runtime Architecture

This document captures the intended runtime architecture for tenant-isolated, multi-turn, hybrid journey execution.

## Core Principle

Agents do not freely coordinate with each other. A single session orchestrator owns the turn, loads tenant-scoped configuration, invokes bounded runtime profiles when allowed, and commits state only after deterministic validation.

```text
Agents propose. Runtime commits.
```

## Tenant And Session Isolation

Every turn executes inside a tenant and conversation boundary:

```text
tenant_id + conversation_id + journey_id + runtime_profile_id
```

The runtime must verify that all loaded entities belong to the same tenant:

```text
request tenant
  == conversation.tenant_id
  == dialog_state.tenant_id
  == journey.tenant_id
  == runtime_profile.tenant_id
```

```mermaid
flowchart TD
    A["Incoming User Turn"] --> B["Resolve tenant_id"]
    B --> C["Load conversation by tenant"]
    C --> D["Load dialog state by tenant"]
    D --> E["Load journey by tenant"]
    E --> F["Load active runtime profiles by tenant"]
    F --> G{"Tenant access valid?"}
    G -- "No" --> H["Return 404/deny"]
    G -- "Yes" --> I["Execute turn"]
```

## Multi-Agent Runtime Model

The system uses runtime profiles instead of autonomous long-lived agents.

```mermaid
flowchart LR
    U["User"] --> O["Session Orchestrator"]
    O --> R["Router Profile"]
    R --> O
    O --> J["Journey Runtime"]
    J --> S["Specialist Profile"]
    S --> J
    J --> P["Policy Checker"]
    P --> J
    J --> T["Tool Executor"]
    T --> J
    J --> C["Response Composer"]
    C --> U
    J --> A["Audit + State Store"]
```

### Profile Types

Router profile:
- Maps user query to intent.
- Selects journey and specialist profile.
- Runs when no journey is active, or when rerouting is explicitly allowed.

Specialist profile:
- Extracts slots.
- Drafts responses.
- Proposes actions from allowed choices.
- Uses only allowed tools, journeys, and slots.

Policy profile/checker:
- Allows, denies, escalates, or requires approval.
- Runs before slot writes, tool calls, transitions, and final response.

Tool executor:
- Calls client APIs through allowlisted tools/contracts.
- Never runs directly from an LLM response.

## Hybrid Journey Execution

Hybrid mode is node-level. The deterministic journey owns state and transitions; LLMs assist only where the node explicitly allows them.

```mermaid
flowchart TD
    A["User Message"] --> B["Load State"]
    B --> C{"Current Node Type"}
    C -->|message/input/condition/action/end| D["Deterministic Node"]
    C -->|llm_extract| E["LLM Extract Allowed Slots"]
    C -->|tool_call| F["Profile-Gated Tool Call"]
    C -->|policy_check| G["Evaluate Runtime Policies"]
    C -->|llm_draft| H["LLM Draft Response"]
    E --> I["Validate Slot Writes"]
    F --> J["Map Tool Output To Variables"]
    G --> K["Set approval/escalation variables"]
    H --> L["Post-response Guardrails"]
    D --> M["Advance Deterministic Transition"]
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N["Persist State + Audit"]
    N --> O["Return Messages/Actions"]
```

Supported hybrid node types:

```json
{
  "type": "llm_extract",
  "data": {
    "profile": "refund_specialist",
    "allowed_slots": ["refund_amount", "refund_reason"]
  }
}
```

```json
{
  "type": "tool_call",
  "data": {
    "profile": "refund_specialist",
    "tool": "order_lookup",
    "input": { "order_number": "{{order_number}}" },
    "output_map": {
      "within_return_window": "within_window",
      "total": "refund_amount"
    }
  }
}
```

```json
{
  "type": "policy_check",
  "data": {
    "profile": "refund_specialist"
  }
}
```

```json
{
  "type": "llm_draft",
  "data": {
    "profile": "refund_specialist",
    "instruction": "Explain the approval requirement empathetically.",
    "must_not_claim": ["refund approved"]
  }
}
```

## Multi-Turn Example

```mermaid
sequenceDiagram
    participant U as User
    participant O as Orchestrator
    participant R as Router Profile
    participant J as Journey Runtime
    participant S as Specialist Profile
    participant P as Policy Checker
    participant T as Tool Executor
    participant A as Audit Store

    U->>O: "My phone arrived cracked"
    O->>R: classify intent
    R-->>O: defective_return, returns_flow, refund_specialist
    O->>J: start journey
    J->>S: extract allowed slots
    S-->>J: return_reason=defective
    J->>P: validate slot write
    P-->>J: allow
    J->>A: persist state
    J-->>U: ask for order number

    U->>O: "Order 99881"
    O->>J: continue current journey
    J->>S: extract order_number
    S-->>J: order_number=99881
    J->>P: validate slot/tool permissions
    P-->>J: allow
    J->>T: order_lookup
    T-->>J: total=800, within_window=true
    J->>P: evaluate refund policy
    P-->>J: require_approval
    J->>A: persist variables + policy event
    J-->>U: explain approval requirement
```

## Runtime Profile Shape

Runtime profiles are tenant-scoped configuration.

```json
{
  "name": "refund_specialist",
  "kind": "specialist",
  "allowed_journeys": ["refund_v2"],
  "allowed_tools": ["order_lookup", "process_refund"],
  "allowed_slots": ["order_number", "refund_amount", "refund_reason"],
  "guardrails": ["Never approve refunds over threshold"],
  "policies": [
    {
      "id": "refund_over_500",
      "effect": "require_approval",
      "when": { "op": "gt", "var": "refund_amount", "value": 500 },
      "reason": "Refund exceeds manager approval threshold"
    }
  ]
}
```

## Persistence

Important runtime tables:

- `journeys`: workflow graph, execution mode, variables.
- `dialog_states`: current node, session variables, history, context.
- `runtime_profiles`: tenant-scoped router/specialist/policy configuration.
- `journey_scenarios`: DB-backed scenario DSL/test packs.
- `simulation_runs`: scenario execution results.
- `messages`: conversation transcript.

## Current Code Anchors

- Journey validation: `src/lib/journey/schema.ts`
- Scenario DSL/runner: `src/lib/journey/scenario-runner.ts`
- Runtime profiles: `src/lib/runtime/profiles.ts`
- Tenant runtime loader: `src/lib/runtime/tenant-runtime.ts`
- Tenant guard: `src/lib/runtime/tenant-guard.ts`
- Node-level hybrid executor: `src/lib/runtime/hybrid-executor.ts`
- Dialog execute route: `src/app/api/dialog/execute/route.ts`
- Dialog stream route: `src/app/api/dialog/stream/route.ts`
