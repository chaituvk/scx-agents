import { NextResponse } from "next/server";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Sierra AI Platform API",
    version: "1.0.0",
    description: "Conversational AI platform API — manage agents, conversations, playbooks, and integrations.",
    contact: { name: "Sierra Support", url: "https://sierra.ai/docs" },
  },
  servers: [
    { url: "/api", description: "Current server" },
    { url: "/api/v1", description: "Versioned API (v1)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Sierra JWT session token or API key" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "sierra_token" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      Conversation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          tenant_id: { type: "string" },
          customer_name: { type: "string", nullable: true },
          customer_email: { type: "string", nullable: true },
          channel: { type: "string", enum: ["web", "sms", "whatsapp", "email", "api"] },
          status: { type: "string", enum: ["open", "closed", "escalated"] },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          priority: { type: "string", enum: ["normal", "high", "urgent"] },
          assigned_to: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          conversation_id: { type: "string" },
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string" },
          intent: { type: "string", nullable: true },
          agent_id: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Playbook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          persona: { type: "string" },
          status: { type: "string", enum: ["draft", "active", "archived"] },
          topics: { type: "array", items: { type: "string" } },
          instructions: { type: "array", items: { type: "string" } },
          policies: { type: "array", items: { type: "object", properties: { text: { type: "string" }, severity: { type: "string", enum: ["hard", "soft"] } } } },
          actions: { type: "array", items: { type: "string" } },
          escalation_triggers: { type: "array", items: { type: "string" } },
        },
      },
      OrchestratorResponse: {
        type: "object",
        properties: {
          response: { type: "string" },
          intent: { type: "string" },
          subAgent: { type: "string" },
          done: { type: "boolean" },
          variables: { type: "object", additionalProperties: { type: "string" } },
          supervisor: {
            type: "object",
            properties: {
              pass: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["active", "disabled"] },
          description: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          key_prefix: { type: "string" },
          scopes: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["active", "revoked"] },
          last_used_at: { type: "string", format: "date-time", nullable: true },
          expires_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        tags: ["System"],
        security: [],
        responses: { 200: { description: "Healthy" }, 503: { description: "Degraded or down" } },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness probe",
        tags: ["System"],
        security: [],
        responses: { 200: { description: "Ready to serve traffic" }, 503: { description: "Not ready" } },
      },
    },
    "/orchestrator": {
      post: {
        summary: "Run a conversation turn",
        tags: ["Core"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["conversationId", "message"],
                properties: {
                  conversationId: { type: "string" },
                  message: { type: "string" },
                  tenantId: { type: "string" },
                  variables: { type: "object", additionalProperties: { type: "string" } },
                  channel: { type: "string", enum: ["web", "sms", "whatsapp", "email"] },
                  forceSubAgent: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Turn result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/OrchestratorResponse" } } },
          },
        },
      },
    },
    "/orchestrator/stream": {
      post: {
        summary: "Stream a conversation turn via SSE",
        tags: ["Core"],
        security: [],
        responses: {
          200: {
            description: "Server-sent events: start, route_decision, tool_call, supervisor, complete",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/conversations": {
      get: {
        summary: "List conversations",
        tags: ["Conversations"],
        responses: { 200: { description: "Conversation list" } },
      },
      post: {
        summary: "Create a conversation",
        tags: ["Conversations"],
        responses: { 201: { description: "Created conversation" } },
      },
    },
    "/conversations/search": {
      get: {
        summary: "Search conversations",
        tags: ["Conversations"],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "channel", in: "query", schema: { type: "string" } },
          { name: "assigned_to", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { 200: { description: "Matching conversations" } },
      },
    },
    "/conversations/{id}": {
      get: { summary: "Get conversation", tags: ["Conversations"], responses: { 200: { description: "Conversation" } } },
      put: { summary: "Update conversation", tags: ["Conversations"], responses: { 200: { description: "Updated conversation" } } },
    },
    "/conversations/{id}/messages": {
      get: { summary: "Get messages", tags: ["Conversations"], responses: { 200: { description: "Message list" } } },
    },
    "/conversations/{id}/stream": {
      get: { summary: "Subscribe to live messages via SSE", tags: ["Conversations"], responses: { 200: { description: "SSE event stream" } } },
    },
    "/conversations/{id}/assign": {
      post: { summary: "Assign conversation to agent/user", tags: ["Conversations"], responses: { 200: { description: "Assignment confirmed" } } },
    },
    "/conversations/{id}/close": {
      post: { summary: "Close a conversation", tags: ["Conversations"], responses: { 200: { description: "Closed" } } },
    },
    "/conversations/{id}/summary": {
      get: { summary: "AI-generated conversation summary", tags: ["Conversations"], responses: { 200: { description: "Summary text" } } },
    },
    "/playbooks": {
      get: { summary: "List playbooks", tags: ["Playbooks"], responses: { 200: { description: "Playbook list" } } },
      post: { summary: "Create playbook", tags: ["Playbooks"], responses: { 201: { description: "Created" } } },
    },
    "/webhooks": {
      get: { summary: "List webhooks", tags: ["Webhooks"], responses: { 200: { description: "Webhook list" } } },
      post: { summary: "Create webhook", tags: ["Webhooks"], responses: { 201: { description: "Created with secret" } } },
    },
    "/webhooks/{id}": {
      get: { summary: "Get webhook", tags: ["Webhooks"], responses: { 200: { description: "Webhook" } } },
      put: { summary: "Update webhook", tags: ["Webhooks"], responses: { 200: { description: "Updated" } } },
      delete: { summary: "Delete webhook", tags: ["Webhooks"], responses: { 204: { description: "Deleted" } } },
    },
    "/webhooks/{id}/deliveries": {
      get: { summary: "List delivery attempts", tags: ["Webhooks"], responses: { 200: { description: "Delivery log" } } },
    },
    "/api-keys": {
      get: { summary: "List API keys", tags: ["API Keys"], responses: { 200: { description: "Key list (no secrets)" } } },
      post: { summary: "Create API key", tags: ["API Keys"], responses: { 201: { description: "Key with plaintext (shown once)" } } },
    },
    "/api-keys/{id}": {
      delete: { summary: "Revoke API key", tags: ["API Keys"], responses: { 204: { description: "Revoked" } } },
    },
    "/csat": {
      post: { summary: "Submit CSAT rating", tags: ["CSAT"], security: [], responses: { 201: { description: "Rating saved" } } },
      get: { summary: "Get CSAT summary for tenant", tags: ["CSAT"], responses: { 200: { description: "Summary + distribution" } } },
    },
    "/knowledge/sources": {
      get: { summary: "List knowledge sources", tags: ["Knowledge"], responses: { 200: { description: "Source list" } } },
      post: { summary: "Create knowledge source", tags: ["Knowledge"], responses: { 201: { description: "Created" } } },
    },
    "/knowledge/upload": {
      post: {
        summary: "Upload a document for indexing",
        tags: ["Knowledge"],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, sourceId: { type: "string" } } } } },
        },
        responses: { 201: { description: "Indexed document with chunk count" } },
      },
      get: { summary: "List uploaded documents", tags: ["Knowledge"], responses: { 200: { description: "Document list" } } },
    },
    "/insights": {
      get: { summary: "KPI dashboard data", tags: ["Analytics"], responses: { 200: { description: "Metrics + trends" } } },
    },
    "/metrics": {
      get: { summary: "Prometheus metrics export", tags: ["Analytics"], security: [], responses: { 200: { description: "Prometheus text format" } } },
    },
    "/playbooks/{id}/versions": {
      get: { summary: "List playbook version history", tags: ["Playbooks"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Version list" } } },
      post: { summary: "Snapshot current playbook as a new version", tags: ["Playbooks"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "New version" } } },
    },
    "/proactive-triggers": {
      get: { summary: "List proactive chat triggers", tags: ["Proactive"], responses: { 200: { description: "Trigger list" } } },
      post: { summary: "Create proactive trigger", tags: ["Proactive"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "message"], properties: { name: { type: "string" }, trigger_type: { type: "string", enum: ["page_dwell", "exit_intent", "scroll_depth", "return_visitor", "custom"] }, message: { type: "string" }, conditions: { type: "object" }, delay_seconds: { type: "integer" }, cooldown_hours: { type: "integer" }, playbook_id: { type: "string" } } } } } }, responses: { 201: { description: "Created trigger" } } },
    },
    "/proactive-triggers/{id}": {
      get: { summary: "Get proactive trigger", tags: ["Proactive"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Trigger" }, 404: { description: "Not found" } } },
      put: { summary: "Update proactive trigger", tags: ["Proactive"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated trigger" } } },
      delete: { summary: "Delete proactive trigger", tags: ["Proactive"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
    },
    "/agents/{id}/status": {
      get: { summary: "Get agent availability status", tags: ["Agents"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Status object", content: { "application/json": { schema: { type: "object", properties: { agent_id: { type: "string" }, status: { type: "string", enum: ["online", "away", "offline", "busy"] }, updated_at: { type: "string", format: "date-time" } } } } } } } },
      put: { summary: "Set agent availability status", tags: ["Agents"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["online", "away", "offline", "busy"] } } } } } }, responses: { 200: { description: "Updated status" }, 403: { description: "Cannot set status for another agent" } } },
    },
    "/conversations/{id}/typing": {
      get: { summary: "Typing indicator SSE stream", tags: ["Conversations"], security: [], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "SSE stream — events: { typing: boolean }" } } },
    },
    "/conversations/{id}/accept-handoff": {
      post: { summary: "Accept escalated conversation handoff", tags: ["Conversations"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Accepted handoff — conversation assigned to caller" }, 409: { description: "Conversation not in escalated state" } } },
    },
    "/widget/triggers": {
      get: { summary: "Public: proactive triggers for web widget", tags: ["Widget"], security: [], parameters: [{ name: "tenant_id", in: "query", required: true, schema: { type: "string" } }, { name: "trigger_type", in: "query", required: false, schema: { type: "string" } }], responses: { 200: { description: "Active triggers for the tenant" } } },
    },
  },
};

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
