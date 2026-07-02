// Loads tenant integration configs from DB and registers HTTP adapters for each active integration.
// Called at the start of each playbook test request so tool calls route to real APIs.

import { query } from "@/lib/db";
import { registerTenantAdapters, TenantToolConfig } from "./http-adapter";

// Maps integration type → tool name → proxy action identifier
const INTEGRATION_TOOL_MAP: Record<string, Record<string, string>> = {
  shopify: {
    order_lookup: "order_lookup",
    check_return_eligibility: "check_return_eligibility",
    process_refund: "process_refund",
    generate_label: "generate_label",
  },
  stripe: {
    process_refund: "process_refund",
  },
  zendesk: {
    escalate_to_human: "create_ticket",
    search_knowledge: "search",
  },
  salesforce: {
    escalate_to_human: "create_case",
  },
  intercom: {
    escalate_to_human: "create_conversation",
  },
  hubspot: {
    escalate_to_human: "create_ticket",
  },
};

// Which tools each integration type enables — used in the UI to show live/mock status
export const INTEGRATION_SUPPORTED_TOOLS: Record<string, string[]> = {
  shopify:    ["order_lookup", "check_return_eligibility", "process_refund", "generate_label"],
  stripe:     ["process_refund"],
  zendesk:    ["escalate_to_human", "search_knowledge"],
  salesforce: ["escalate_to_human"],
  intercom:   ["escalate_to_human"],
  hubspot:    ["escalate_to_human"],
};

export async function loadTenantToolAdapters(tenantId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT id, type FROM integrations WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );

    const configs: TenantToolConfig[] = [];
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    for (const row of res.rows) {
      const toolActions = INTEGRATION_TOOL_MAP[row.type as string];
      if (!toolActions) continue;

      for (const [toolName, action] of Object.entries(toolActions)) {
        configs.push({
          tool: toolName,
          url: `${baseUrl}/api/tools/proxy?integration=${encodeURIComponent(row.type)}&action=${encodeURIComponent(action)}&integrationId=${encodeURIComponent(row.id)}`,
          method: "POST",
        });
      }
    }

    if (configs.length > 0) {
      registerTenantAdapters(configs);
    }
  } catch (err) {
    console.error("[integration-loader]", err);
  }
}
