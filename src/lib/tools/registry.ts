export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, any>) => Promise<any>;
}

export const tools: Record<string, Tool> = {
  order_lookup: {
    name: "order_lookup",
    description: "Look up an order by order number or email. Returns order details including status, items, and delivery info.",
    parameters: {
      order_number: { type: "string", description: "The order number (e.g., #45678)", required: false },
      email: { type: "string", description: "Customer email address", required: false },
    },
    execute: async (params) => {
      // Mock order lookup
      const orderNumber = params.order_number || "#" + Math.floor(10000 + Math.random() * 90000);
      return {
        order_id: orderNumber,
        status: Math.random() > 0.3 ? "delivered" : "shipped",
        items: ["Wireless Headphones", "USB-C Cable"],
        total: 89.99,
        order_date: "2026-04-15",
        delivery_date: "2026-04-20",
        within_return_window: Math.random() > 0.3,
      };
    },
  },

  check_return_eligibility: {
    name: "check_return_eligibility",
    description: "Check if an order is within the return window (30 days). Returns eligibility status.",
    parameters: {
      order_id: { type: "string", description: "Order ID", required: true },
    },
    execute: async (params) => {
      return {
        eligible: true,
        days_remaining: 18,
        return_deadline: "2026-05-15",
      };
    },
  },

  process_refund: {
    name: "process_refund",
    description: "Process a refund for an order. Returns refund status and timeline.",
    parameters: {
      order_id: { type: "string", description: "Order ID", required: true },
      amount: { type: "number", description: "Refund amount", required: true },
      reason: { type: "string", description: "Refund reason", required: false },
    },
    execute: async (params) => {
      const needsApproval = params.amount > 500;
      if (needsApproval) {
        return {
          status: "pending_approval",
          message: "Refund over $500 requires manager approval.",
          reference: "REF-" + Math.floor(100000 + Math.random() * 900000),
        };
      }
      return {
        status: "approved",
        message: "Refund approved. Will appear in 3-5 business days.",
        reference: "REF-" + Math.floor(100000 + Math.random() * 900000),
      };
    },
  },

  process_replacement: {
    name: "process_replacement",
    description: "Ship a replacement item for a defective or wrong product.",
    parameters: {
      order_id: { type: "string", description: "Order ID", required: true },
      item_sku: { type: "string", description: "Item SKU to replace", required: true },
    },
    execute: async (params) => {
      return {
        status: "shipped",
        tracking_number: "1Z999AA10123456784",
        estimated_delivery: "3-5 business days",
      };
    },
  },

  generate_label: {
    name: "generate_label",
    description: "Generate a prepaid return shipping label.",
    parameters: {
      order_id: { type: "string", description: "Order ID", required: true },
    },
    execute: async (params) => {
      return {
        label_url: "https://returns.example.com/label/abc123",
        expires_in: "30 days",
      };
    },
  },

  verify_identity: {
    name: "verify_identity",
    description: "Verify customer identity using KYC checks. Returns verification status and risk score.",
    parameters: {
      ssn_last4: { type: "string", description: "Last 4 digits of SSN", required: true },
      dob: { type: "string", description: "Date of birth (MM/DD/YYYY)", required: true },
    },
    execute: async (params) => {
      const ssn = params.ssn_last4 || "0000";
      const lastDigit = parseInt(ssn.slice(-1)) || 0;
      if (lastDigit >= 8) {
        return { status: "rejected", risk_score: 85, reason: "High risk profile" };
      } else if (lastDigit >= 5) {
        return { status: "pending", risk_score: 50, reason: "Manual review required" };
      }
      return { status: "verified", risk_score: 20, reason: "Clear" };
    },
  },

  apply_promo_code: {
    name: "apply_promo_code",
    description: "Apply a promotional code to an order or account.",
    parameters: {
      code: { type: "string", description: "Promo code", required: true },
      order_id: { type: "string", description: "Order ID (optional)", required: false },
    },
    execute: async (params) => {
      const validCodes = ["WELCOME10", "SAVE20", "FREESHIP"];
      if (validCodes.includes(params.code?.toUpperCase())) {
        return { applied: true, discount: params.code?.toUpperCase() === "SAVE20" ? 20 : 10, message: "Promo applied successfully." };
      }
      return { applied: false, discount: 0, message: "Invalid or expired promo code." };
    },
  },

  search_knowledge: {
    name: "search_knowledge",
    description: "Search the knowledge base for policies, FAQs, or help articles.",
    parameters: {
      query: { type: "string", description: "Search query", required: true },
    },
    execute: async (params) => {
      const query = params.query.toLowerCase();
      const kb = [
        { title: "Return Policy", content: "Items can be returned within 30 days for full refund. Defective items get free replacement." },
        { title: "Shipping Times", content: "Standard: 3-5 business days. Express: 1-2 days ($9.99)." },
        { title: "Warranty", content: "All electronics carry 1-year manufacturer warranty plus 90-day return window." },
      ];
      const results = kb.filter((a: { title: string; content: string }) => query.split(" ").some((w: string) => a.title.toLowerCase().includes(w) || a.content.toLowerCase().includes(w)));
      return { results: results.length > 0 ? results : kb.slice(0, 2) };
    },
  },

  escalate_to_human: {
    name: "escalate_to_human",
    description: "Transfer the conversation to a human agent with full context.",
    parameters: {
      reason: { type: "string", description: "Reason for escalation", required: true },
      department: { type: "string", description: "Target department", required: false },
    },
    execute: async (params) => {
      return {
        transferred: true,
        ticket_id: "TKT-" + Math.floor(10000 + Math.random() * 90000),
        estimated_wait: "2 minutes",
        department: params.department || "Support",
      };
    },
  },
};

export function getToolDescriptions(skillNames: string[]): string {
  const relevant = skillNames
    .map((s) => tools[s])
    .filter(Boolean)
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `${k}: ${v.type}${v.required === false ? " (optional)" : ""} - ${v.description}`)
        .join("\n    ");
      return `${t.name}: ${t.description}\n  Parameters:\n    ${params}`;
    })
    .join("\n\n");
  return relevant || "No tools available.";
}

export async function executeTool(name: string, params: Record<string, any>): Promise<any> {
  const tool = tools[name];
  if (!tool) throw new Error(`Tool '${name}' not found`);
  return tool.execute(params);
}
