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

## Credentials

All tenants share the same demo password: `sierra2026`

| Tenant | Email |
|--------|-------|
| r-mobile | `admin@sierra.ai` |
| ichiba | `admin@ichiba.ai` |
| r-travel | `admin@rtravel.ai` |
