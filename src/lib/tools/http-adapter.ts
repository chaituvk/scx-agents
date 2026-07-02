// HttpToolAdapter — plugs real customer API endpoints into the tool registry.
//
// Configure per-tool via environment variables:
//   TOOL_<TOOL_NAME>_URL      e.g. TOOL_ORDER_LOOKUP_URL=https://api.shopify.com/orders
//   TOOL_<TOOL_NAME>_KEY      API key sent as Authorization: Bearer <key>
//   TOOL_<TOOL_NAME>_METHOD   HTTP method (default POST)
//
// Per-tenant overrides can be registered at runtime via registerAdapter().
// This ships with sensible mocks for all tools so the system works
// out-of-the-box; production deployments swap in real URLs via env vars.

import { registerAdapter, type ToolAdapter } from "./registry";

export class HttpToolAdapter implements ToolAdapter {
  constructor(
    private readonly url: string,
    private readonly options: {
      method?: "GET" | "POST" | "PUT" | "PATCH";
      apiKey?: string;
      extraHeaders?: Record<string, string>;
      timeout?: number;
    } = {}
  ) {}

  async execute(params: Record<string, unknown>): Promise<unknown> {
    const method = this.options.method ?? "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.options.extraHeaders,
    };
    if (this.options.apiKey) {
      headers["Authorization"] = `Bearer ${this.options.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeout ?? 10000
    );

    try {
      let url = this.url;
      let body: string | undefined;

      if (method === "GET") {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString();
        if (qs) url = `${url}?${qs}`;
      } else {
        body = JSON.stringify(params);
      }

      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      if (!res.ok) {
        return { error: `HTTP ${res.status}`, message: await res.text().catch(() => "") };
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Auto-register from environment variables ─────────────────────────
// Called once at server startup. Reads TOOL_<NAME>_URL for each known
// tool name and registers an HttpToolAdapter when a URL is configured.

const TOOL_NAMES = [
  "order_lookup",
  "process_refund",
  "check_return_eligibility",
  "process_replacement",
  "generate_label",
  "verify_identity",
  "apply_promo_code",
  "search_knowledge",
];

export function registerHttpAdapters(): void {
  for (const toolName of TOOL_NAMES) {
    const envKey = `TOOL_${toolName.toUpperCase()}_URL`;
    const url = process.env[envKey];
    if (!url) continue;

    const apiKey = process.env[`TOOL_${toolName.toUpperCase()}_KEY`];
    const method = (process.env[`TOOL_${toolName.toUpperCase()}_METHOD`] ?? "POST") as
      | "GET"
      | "POST"
      | "PUT"
      | "PATCH";

    registerAdapter(toolName, new HttpToolAdapter(url, { method, apiKey }));
    console.log(`[tools] HTTP adapter registered for '${toolName}' → ${url}`);
  }
}

// ── Per-tenant runtime adapter ────────────────────────────────────────
// Tenant runtime profiles can carry tool endpoint configs.
// Call this after loading a tenant's runtime profile.

export interface TenantToolConfig {
  tool: string;
  url: string;
  apiKey?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH";
}

export function registerTenantAdapters(configs: TenantToolConfig[]): void {
  for (const cfg of configs) {
    registerAdapter(cfg.tool, new HttpToolAdapter(cfg.url, {
      method: cfg.method ?? "POST",
      apiKey: cfg.apiKey,
    }));
  }
}
