# Stub API Data by Tenant

This folder contains stub JSON data organized by tenant for testing, mocking, and reference.

## Structure

```
test-data/
├── README.md
├── index.json              # All tenants metadata
├── conversations.json      # Cross-tenant conversation stubs
└── tenants/
    ├── r-mobile/
    │   ├── tenants.json
    │   ├── agents.json
    │   ├── journeys.json
    │   ├── integrations.json
    │   ├── runtime-profiles.json
    │   ├── journey-scenarios.json
    │   ├── knowledge-sources.json
    │   ├── knowledge-gaps.json
    │   ├── regression-tests.json
    │   └── voice-sims.json
    ├── ichiba/
    │   └── ...
    └── r-travel/
        └── ...
```

## Tenants

| Tenant | Domain | Primary Color | Tone |
|--------|--------|---------------|------|
| r-mobile | Telecom / Devices | `#ef4444` (Red) | Professional |
| ichiba | E-commerce | `#f97316` (Orange) | Empathetic |
| r-travel | Travel | `#06b6d4` (Cyan) | Enthusiastic |

## Usage

Load stub data for a specific tenant:

```typescript
import rMobileJourneys from "@/test-data/tenants/r-mobile/journeys.json";
import ichibaAgents from "@/test-data/tenants/ichiba/agents.json";
```

## MVP Runtime Fixtures

Each tenant now includes:

- `journeys.json`: deterministic, LLM, and hybrid journey definitions.
- `runtime-profiles.json`: tenant-scoped router/specialist profiles, allowed tools, allowed slots, and policies.
- `journey-scenarios.json`: executable multi-turn scenario DSL for behavior, policy, technical, and guardrail coverage.
  Hybrid scenarios can include `runtime.required_profiles` and `runtime.tool_mocks` for deterministic suite runs.

These fixtures are loaded by `src/lib/seed-mvp-fixtures.ts` during app DB seeding.

Current MVP coverage:

| Tenant | Complex Hybrid Workflow | Runtime Profiles | Scenario DSL Cases |
|--------|--------------------------|------------------|--------------------|
| r-mobile | Device Protection Claim | router + device specialist | 5 |
| ichiba | High Value Refund Review | router + refund specialist | 5 |
| r-travel | Travel Disruption Rebooking | router + disruption specialist | 5 |

## Credentials

All tenants share the same demo password: `sierra2026`

| Tenant | Email |
|--------|-------|
| r-mobile | `admin@sierra.ai` |
| ichiba | `admin@ichiba.ai` |
| r-travel | `admin@rtravel.ai` |
