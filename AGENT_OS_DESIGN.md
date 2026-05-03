# Agent OS — Core Platform Design Document

## 1. System Overview

Agent OS is a conversational AI operating system for enterprise contact centers. It provides infrastructure to build, deploy, orchestrate, and observe AI agents across all customer channels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT OS PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│   │   Studio    │   │    SDK      │   │  Insights   │   │   Voice     │   │
│   │  (No-Code)  │   │  (Pro-Code) │   │ (Analytics) │   │  (Phone)    │   │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   │
│          │                 │                 │                 │          │
│          └─────────────────┴────────┬────────┴─────────────────┘          │
│                                     ▼                                       │
│                        ┌─────────────────────┐                              │
│                        │   AGENT RUNTIME     │                              │
│                        │   (Core Engine)     │                              │
│                        └──────────┬──────────┘                              │
│                                   │                                         │
│          ┌────────────────────────┼────────────────────────┐               │
│          ▼                        ▼                        ▼               │
│   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐           │
│   │   Memory    │        │Orchestrator │        │  Guardrails │           │
│   │   Layer     │        │  (Router)   │        │   Engine    │           │
│   └─────────────┘        └─────────────┘        └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architecture

### 2.1 Service Mesh

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│   Web Chat │ Mobile SDK │ Voice (Twilio) │ Email │ SMS │ WhatsApp │ GPT    │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │
                              ┌────┴────┐
                              │  LB/WAF │
                              └────┬────┘
                                   │
┌──────────────────────────────────┼─────────────────────────────────────────┐
│                         API GATEWAY (Next.js App Router)                   │
│  /api/v1/conversations │ /api/v1/agents │ /api/v1/journeys │ /api/v1/chat │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  CONVERSATION   │    │  AGENT RUNTIME  │    │   JOURNEY       │
│    SERVICE      │    │    SERVICE      │    │   EXECUTOR      │
│                 │    │                 │    │                 │
│ - Session mgmt  │    │ - Intent detect │    │ - Node traversal│
│ - Context       │    │ - Response gen  │    │ - State machine │
│ - History       │    │ - Tool calls    │    │ - Branching     │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
              ┌─────────────────────────────────┐
              │       SHARED SERVICES LAYER      │
              ├─────────────────────────────────┤
              │  Memory Store  │  Event Bus     │
              │  (SQLite/Redis)│  (SSE/WebSock) │
              ├─────────────────────────────────┤
              │  Guardrails    │  Observability │
              │  Engine        │  (Metrics/Logs)│
              └─────────────────────────────────┘
```

---

## 3. Agent Runtime (Core Engine)

### 3.1 Agent Definition

```typescript
interface Agent {
  id: string;
  name: string;
  version: string;
  
  // Cognitive layer
  model: "gpt-4o" | "claude-3-5" | "gemini-1.5";
  temperature: number;        // 0.0 = deterministic, 1.0 = creative
  systemPrompt: string;
  
  // Capability layer
  goals: Goal[];              // What the agent tries to achieve
  skills: Skill[];            // Tools/functions the agent can call
  guardrails: Guardrail[];    // Hard constraints
  
  // Memory layer
  memory: {
    persistent: boolean;      // Cross-conversation memory
    contextWindow: number;    // Tokens to retain
    entityExtraction: boolean;// Auto-extract names, orders, etc.
  };
  
  // Channel layer
  channels: Channel[];        // Where this agent deploys
  
  // Routing layer
  router: {
    triggers: Trigger[];      // When to activate this agent
    priority: number;         // 1-100, higher = preferred
    fallback: string;         // Agent ID to fallback to
  };
}
```

### 3.2 Agent Execution Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   INCOMING   │────▶│   CONTEXT    │────▶│   INTENT     │
│   MESSAGE    │     │   BUILDER    │     │   DETECTOR   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   RESPONSE   │◀────│   RESPONSE   │◀────│   DECISION   │
│   FORMATTER  │     │   GENERATOR  │     │   ENGINE     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┘
                    ▼
            ┌──────────────┐
            │   TOOL       │
            │   EXECUTOR   │
            └──────────────┘
```

**Execution Steps:**
1. **Context Builder** — Pull customer profile, conversation history, real-time signals
2. **Intent Detector** — Classify intent + extract entities (order #, dates, amounts)
3. **Decision Engine** — Check guardrails → Route to skill → Determine if tool call needed
4. **Tool Executor** — Call CRM, payment API, shipping tracker (if needed)
5. **Response Generator** — LLM generates response with tool results
6. **Response Formatter** — Adapt to channel (short for SMS, rich for web)

---

## 4. Multi-Agent Orchestrator

### 4.1 Agent Routing Decision Tree

```
Incoming Message
       │
       ▼
┌─────────────────┐
│ Intent Detector │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┬────────┐
    ▼         ▼        ▼        ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│Sales  │ │Support│ │Billing│ │KYC    │ │Returns│
│Agent  │ │Agent  │ │Agent  │ │Agent  │ │Agent  │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │
    └─────────┴─────────┴────┬────┴─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  If no match →  │
                    │ Generalist Agent│
                    └─────────────────┘
```

### 4.2 Orchestrator Interface

```typescript
interface Orchestrator {
  // Register an agent with routing rules
  register(agent: Agent, rules: RoutingRule[]): void;
  
  // Route a message to the best agent
  route(context: ConversationContext): AgentSelection;
  
  // Handle agent handoffs
  handoff(from: string, to: string, reason: string): void;
  
  // Multi-agent collaboration
  collaborate(agents: string[], task: Task): Promise<Response>;
}

interface RoutingRule {
  intent?: string[];           // ["refund", "return"]
  keywords?: string[];         // ["price", "discount", "deal"]
  entities?: EntityPattern[];  // { type: "product", value: "laptop" }
  sentiment?: "positive" | "negative" | "angry";
  customerTier?: "vip" | "enterprise" | "standard";
  channel?: string;            // "voice" | "chat"
  priority: number;            // Override priority
}
```

---

## 5. Dialog Engine (Journey Executor)

### 5.1 State Machine Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DIALOG STATE MACHINE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐│
│   │  START  │───▶│ MESSAGE │───▶│  INPUT  │───▶│CONDITION││
│   └─────────┘    └─────────┘    └────┬────┘    └────┬────┘│
│                                       │               │    │
│   ┌─────────┐    ┌─────────┐    ┌────┴────┐    ┌────┘    │
│   │   END   │◀───│  ACTION │◀───│   API   │◀───┘         │
│   └─────────┘    └─────────┘    └─────────┘              │
│                                                              │
│   Node Types:                                                │
│   • start — Entry point                                      │
│   • message — Send text (auto-chains to next)               │
│   • input — Wait for user response                           │
│   • condition — Branch based on variable value               │
│   • action — Set/clear variables silently                    │
│   • api — Call external service (blocking)                   │
│   • transfer — Handoff to human                              │
│   • end — Terminate dialog                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 State Persistence

```typescript
interface DialogState {
  conversationId: string;
  journeyId: string;
  currentNodeId: string;
  
  // Slot filling
  variables: Record<string, string>;
  
  // Execution trace
  history: Array<{
    nodeId: string;
    timestamp: string;
    input?: string;
    output?: string;
  }>;
  
  // Context for intent detection
  context: {
    lastMessage: string;
    detectedIntent: string;
    retryCount: number;
  };
}
```

---

## 6. Memory & Personalization Layer

### 6.1 Memory Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      MEMORY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  L1: EPHEMERAL (Conversation)                               │
│  ├── Current conversation turns                             │
│  ├── Extracted entities (order #, dates, amounts)           │
│  └── Sentiment trajectory                                    │
│  TTL: Session lifetime                                       │
│                                                              │
│  L2: SHORT-TERM (Customer Profile)                          │
│  ├── Identity (name, email, phone, tier)                    │
│  ├── Preferences (language, channel, time zone)             │
│  └── Recent history (last 90 days)                          │
│  TTL: 90 days                                                │
│                                                              │
│  L3: LONG-TERM (Customer 360)                               │
│  ├── Lifetime value, order history                          │
│  ├── Issue patterns, escalation history                     │
│  └── Marketing consent, privacy settings                    │
│  TTL: Permanent                                              │
│                                                              │
│  L4: KNOWLEDGE (Enterprise)                                 │
│  ├── Product catalog, pricing, policies                     │
│  ├── SOPs, troubleshooting guides                           │
│  └── Brand voice, tone guidelines                           │
│  TTL: Version-controlled                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Memory Retrieval

```typescript
interface MemoryQuery {
  customerId: string;
  conversationId?: string;
  
  // What to retrieve
  layers: ("ephemeral" | "short-term" | "long-term" | "knowledge")[];
  
  // Filters
  timeRange?: { from: Date; to: Date };
  topics?: string[];
  
  // Ranking
  recencyWeight: number;    // 0-1, higher = prefer recent
  relevanceWeight: number;  // 0-1, higher = semantic relevance
}

// Retrieved context injected into LLM prompt
function buildContext(query: MemoryQuery): string {
  const profile = getCustomerProfile(query.customerId);
  const history = getConversationHistory(query.conversationId);
  const relevant = semanticSearch(query.topics);
  return `[Profile] ${profile}\n[History] ${history}\n[Knowledge] ${relevant}`;
}
```

---

## 7. Guardrails Engine

### 7.1 Guardrail Types

```typescript
type GuardrailType = 
  | "content_filter"      // Block toxic, PII, medical advice
  | "policy_enforcement"  // No refunds > $500 without approval
  | "topic_restriction"   // Stay in domain (no legal advice)
  | "action_limit"        // Max 3 escalations per hour
  | "rate_limit"          // Max 10 API calls per minute
  | "approval_gate";      // Human approval for sensitive actions

interface Guardrail {
  id: string;
  type: GuardrailType;
  name: string;
  condition: GuardrailCondition;
  action: GuardrailAction;
  severity: "block" | "warn" | "log";
}

type GuardrailCondition = 
  | { type: "contains_pii" }
  | { type: "intent_matches"; intents: string[] }
  | { type: "variable_check"; variable: string; operator: string; value: string }
  | { type: "api_response"; field: string; operator: string; value: string }
  | { type: "custom"; evaluate: (context: Context) => boolean };

type GuardrailAction =
  | { type: "block"; message: string }
  | { type: "mask"; fields: string[] }
  | { type: "escalate"; to: string }
  | { type: "require_approval"; from: string[] }
  | { type: "rewrite"; prompt: string };
```

### 7.2 Guardrail Execution Flow

```
User Message
    │
    ▼
┌─────────────────┐
│ Content Filter  │── Blocked? → Return safe message
│ (PII/Toxic/Off) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Intent Guard    │── Restricted? → Return boundary message
│ (Topic check)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Policy Guard    │── Violation? → Escalate / Require approval
│ (Business rules)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Action Guard    │── Limit exceeded? → Queue / Throttle
│ (Rate limits)   │
└────────┬────────┘
         │
         ▼
    Continue to Agent
```

---

## 8. Observability & Insights

### 8.1 Telemetry Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Agent      │───▶│  Event      │───▶│  Stream     │───▶│  Analytics  │
│  Runtime    │    │  Collector  │    │  Processor  │    │  Store      │
│             │    │             │    │             │    │             │
│ - Turn      │    │ - Kafka/    │    │ - Enrich    │    │ - ClickHouse│
│ - Latency   │    │   Redis     │    │ - Aggregate │    │ - Druid     │
│ - Tokens    │    │             │    │ - Anomaly   │    │             │
│ - Tools     │    │             │    │   detect    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
           ┌─────────────────┐
           │   DASHBOARDS    │
           ├─────────────────┤
           │ • Explorer      │
           │ • Monitors      │
           │ • Experiments   │
           │ • Observability │
           └─────────────────┘
```

### 8.2 Key Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Resolution Rate** | % of conversations resolved without human | > 90% |
| **CSAT** | Customer satisfaction score (1-5) | > 4.5 |
| **Containment** | % stays within AI (no transfer) | > 85% |
| **Latency (P95)** | 95th percentile response time | < 2s |
| **Hallucination Rate** | % of factually incorrect responses | < 0.1% |
| **Cost per Resolution** | LLM tokens + infra cost / resolved conv | Minimize |
| **Guardrail Trigger Rate** | % of messages that hit guardrails | < 5% |

---

## 9. API Design

### 9.1 Core Platform APIs

```yaml
# Conversations
POST   /api/v1/conversations              # Create conversation
GET    /api/v1/conversations/:id           # Get conversation
GET    /api/v1/conversations/:id/messages  # Get messages
POST   /api/v1/conversations/:id/messages  # Send message (AI responds)

# Agents
GET    /api/v1/agents                      # List agents
POST   /api/v1/agents                      # Create agent
GET    /api/v1/agents/:id                  # Get agent config
PATCH  /api/v1/agents/:id                  # Update agent
POST   /api/v1/agents/:id/deploy          # Deploy to production
POST   /api/v1/agents/:id/test            # Test agent

# Journeys (Dialog Flows)
GET    /api/v1/journeys                    # List journeys
POST   /api/v1/journeys                    # Create journey
GET    /api/v1/journeys/:id                # Get journey
PATCH  /api/v1/journeys/:id                # Update journey
POST   /api/v1/journeys/:id/execute        # Execute journey step

# Memory
GET    /api/v1/customers/:id/profile      # Get customer 360
POST   /api/v1/customers/:id/memories     # Add memory
GET    /api/v1/customers/:id/history      # Get conversation history

# Insights
GET    /api/v1/metrics                    # KPIs and trends
GET    /api/v1/conversations/flagged      # Flagged conversations
POST   /api/v1/experiments                # A/B test
GET    /api/v1/observability/traces       # Full execution traces

# Guardrails
GET    /api/v1/guardrails                 # List guardrails
POST   /api/v1/guardrails                 # Create guardrail
POST   /api/v1/guardrails/:id/evaluate    # Test guardrail

# Real-time
GET    /api/v1/stream/:conversationId     # SSE stream for live chat
```

### 9.2 Message Protocol

```typescript
// Request
interface ChatRequest {
  conversationId: string;
  message: string;
  channel: "web" | "voice" | "email" | "sms" | "whatsapp";
  context?: {
    customerId?: string;
    sessionData?: Record<string, unknown>;
  };
}

// Response (streaming)
interface ChatStreamEvent {
  type: "chunk" | "tool_call" | "guardrail" | "transfer" | "done";
  
  // For type="chunk"
  content?: string;
  
  // For type="tool_call"
  tool?: { name: string; params: Record<string, unknown> };
  result?: unknown;
  
  // For type="guardrail"
  guardrail?: { name: string; action: string };
  
  // For type="transfer"
  transfer?: { to: string; reason: string };
  
  // Metadata
  agent?: { id: string; name: string };
  latency?: number;
  tokens?: { input: number; output: number };
}
```

---

## 10. Security & Compliance

### 10.1 Data Flow Security

```
┌──────────┐   TLS 1.3   ┌──────────┐   mTLS    ┌──────────┐
│  Client  │◀───────────▶│   WAF    │◀────────▶│   API    │
│          │             │ (CloudFlare)│        │ Gateway  │
└──────────┘             └──────────┘          └────┬─────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                         ┌─────────┐         ┌─────────┐         ┌─────────┐
                         │Encrypt  │         │Audit Log│         │PII Mask │
                         │at Rest  │         │ (Immutable)       │Engine   │
                         │(AES-256)│         └─────────┘         └─────────┘
                         └─────────┘
```

### 10.2 Compliance Matrix

| Requirement | Implementation |
|-------------|---------------|
| **SOC 2** | Audit logs, access controls, encryption |
| **GDPR** | Right to deletion, data portability, consent mgmt |
| **CCPA** | Opt-out, data sale disclosure |
| **HIPAA** | BAA, PHI encryption, audit trails |
| **PCI DSS** | Tokenized payments, no card data in logs |
| **FedRAMP** | Gov cloud, FIPS 140-2 encryption |

---

## 11. Deployment Architecture

### 11.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                      KUBERNETES CLUSTER                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Web Tier (Next.js)                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │ Pod 1   │ │ Pod 2   │ │ Pod 3   │ │ Pod N   │  │   │
│  │  │ (App)   │ │ (App)   │ │ (App)   │ │ (App)   │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Tier (Node.js/Edge)                 │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐               │   │
│  │  │Agent    │ │Journey  │ │Memory   │               │   │
│  │  │Runtime  │ │Executor │ │Service  │               │   │
│  │  └─────────┘ └─────────┘ └─────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Data Tier                               │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  │  │ SQLite  │ │ Redis   │ │OpenSearch│ │S3/MinIO │  │   │
│  │  │ (State) │ │ (Cache) │ │ (Search) │ │ (Files) │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Scaling Strategy

| Component | Scaling | Trigger |
|-----------|---------|---------|
| Web Tier | Horizontal (pods) | CPU > 70% |
| Agent Runtime | Horizontal + Queue | Queue depth > 100 |
| LLM Calls | Rate limit + Circuit breaker | Latency P95 > 5s |
| Memory (Redis) | Cluster mode | Memory > 80% |
| Database | Read replicas | Query time > 100ms |

---

## 12. Implementation Roadmap

### Phase 1: Core Runtime (Weeks 1-4)
- [x] Agent definition schema
- [x] Basic dialog engine (state machine)
- [x] Intent classification
- [x] Response generation
- [ ] LLM provider abstraction
- [ ] Tool calling framework

### Phase 2: Multi-Agent (Weeks 5-8)
- [x] Agent registry
- [x] Intent-based routing
- [ ] Agent delegation (sub-agents)
- [ ] Cross-agent memory sharing
- [ ] A/B testing between agents

### Phase 3: Enterprise (Weeks 9-12)
- [x] Guardrails engine
- [x] KYC integration pattern
- [ ] SSO / RBAC
- [ ] Audit logging
- [ ] Compliance reporting

### Phase 4: Intelligence (Weeks 13-16)
- [ ] Auto-prompt optimization
- [ ] Conversation summarization
- [ ] Predictive escalation
- [ ] Sentiment trend analysis
- [ ] Continuous learning pipeline

---

## 13. File Structure

```
scx-agents/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/           # Agent CRUD + runtime
│   │   │   ├── chat/             # Main chat endpoint + SSE stream
│   │   │   ├── conversations/    # Session management
│   │   │   ├── dialog/           # Journey execution engine
│   │   │   ├── insights/         # Metrics and analytics
│   │   │   ├── journeys/         # Flow CRUD
│   │   │   ├── kyc/              # KYC verification
│   │   │   └── auth/             # Authentication
│   │   ├── studio/
│   │   │   ├── page.tsx          # Agent Studio landing
│   │   │   └── flows/
│   │   │       └── page.tsx      # Visual flow builder
│   │   └── ...other pages
│   ├── lib/
│   │   ├── dialog/
│   │   │   ├── engine.ts         # Dialog state machine
│   │   │   └── types.ts          # Flow node/edge types
│   │   ├── ai.ts                 # LLM abstraction + agent routing
│   │   ├── auth.ts               # JWT handling
│   │   └── db.ts                 # Database schema + seeding
│   └── components/
│       ├── navigation.tsx
│       └── ui/                   # shadcn components
├── data/
│   └── db.json                   # SQLite/JSON database
└── AGENT_OS_DESIGN.md            # This document
```

---

## 14. Summary

Agent OS is built on **5 foundational layers**:

| Layer | Responsibility | Key Component |
|-------|---------------|---------------|
| **Channel** | Ingest from web, voice, email, SMS | API Gateway |
| **Orchestration** | Route to right agent, manage handoffs | Orchestrator |
| **Cognition** | Understand, decide, respond | Agent Runtime |
| **Memory** | Remember context, personalize | Memory Layer |
| **Governance** | Enforce policy, ensure compliance | Guardrails Engine |

**Design Principles:**
1. **Agent-first** — Everything is an agent with goals, skills, and guardrails
2. **Composable** — Small agents collaborate via the orchestrator
3. **Observable** — Every decision is logged, traceable, and improvable
4. **Secure by default** — Guardrails run before every LLM call
5. **Channel-agnostic** — One agent definition deploys everywhere
