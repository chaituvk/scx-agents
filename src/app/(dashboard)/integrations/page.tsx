"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  Search,
  CheckCircle,
  Loader2,
  ExternalLink,
  Settings,
  Trash2,
  Plus,
  X,
  ChevronRight,
  Zap,
  Database,
  Mail,
  MessageSquare,
  BarChart3,
  ShoppingCart,
  Users,
  Phone,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ConnectedIntegration {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: Record<string, unknown>;
  last_sync?: string | null;
  created_at?: string;
}

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  color: string;
  type: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
  docsUrl?: string;
  popular?: boolean;
}

const MARKETPLACE: MarketplaceItem[] = [
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Sync tickets, create issues from escalations, update ticket status in real-time.",
    category: "Support",
    icon: MessageSquare,
    color: "#03363d",
    type: "zendesk",
    fields: [
      { key: "subdomain", label: "Subdomain", placeholder: "yourcompany" },
      { key: "email", label: "Admin Email", placeholder: "admin@yourcompany.com" },
      { key: "api_token", label: "API Token", placeholder: "••••••••••••", secret: true },
    ],
    popular: true,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Pull customer data, update CRM records, log conversations as activities.",
    category: "CRM",
    icon: Users,
    color: "#00a1e0",
    type: "salesforce",
    fields: [
      { key: "instance_url", label: "Instance URL", placeholder: "https://yourorg.salesforce.com" },
      { key: "client_id", label: "Client ID", placeholder: "••••••••••••", secret: true },
      { key: "client_secret", label: "Client Secret", placeholder: "••••••••••••", secret: true },
    ],
    popular: true,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync contacts, deals, and conversations. Create CRM records from chat leads.",
    category: "CRM",
    icon: BarChart3,
    color: "#ff7a59",
    type: "hubspot",
    fields: [
      { key: "access_token", label: "Private App Token", placeholder: "pat-••••••••••••", secret: true },
      { key: "portal_id", label: "Portal ID", placeholder: "12345678" },
    ],
    popular: true,
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Bi-directional sync of conversations, contacts, and company data.",
    category: "Support",
    icon: MessageSquare,
    color: "#1f8ded",
    type: "intercom",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "dG9rOi••••••••••••", secret: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post escalation alerts, daily digests, and conversation summaries to channels.",
    category: "Messaging",
    icon: MessageSquare,
    color: "#4a154b",
    type: "slack",
    fields: [
      { key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/...", secret: true },
      { key: "channel", label: "Default Channel", placeholder: "#support-escalations" },
    ],
    popular: true,
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS and WhatsApp channel support — receive and send messages via Twilio.",
    category: "Messaging",
    icon: Phone,
    color: "#f22f46",
    type: "twilio",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC••••••••••••" },
      { key: "auth_token", label: "Auth Token", placeholder: "••••••••••••", secret: true },
      { key: "phone_number", label: "Phone Number", placeholder: "+15551234567" },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send transactional emails, CSAT surveys, and digest reports via SendGrid.",
    category: "Email",
    icon: Mail,
    color: "#1a82e2",
    type: "sendgrid",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "SG.••••••••••••", secret: true },
      { key: "from_email", label: "From Email", placeholder: "support@yourcompany.com" },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Look up orders, track shipments, and process returns directly from chat.",
    category: "E-commerce",
    icon: ShoppingCart,
    color: "#96bf48",
    type: "shopify",
    fields: [
      { key: "shop_domain", label: "Shop Domain", placeholder: "yourstore.myshopify.com" },
      { key: "access_token", label: "Admin API Token", placeholder: "shpat_••••••••••••", secret: true },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Look up payment history, issue refunds, and handle billing questions.",
    category: "Payments",
    icon: Database,
    color: "#6772e5",
    type: "stripe",
    fields: [
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_••••••••••••", secret: true },
    ],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create bug reports and feature requests from conversations automatically.",
    category: "Project Management",
    icon: Globe,
    color: "#0052cc",
    type: "jira",
    fields: [
      { key: "domain", label: "Atlassian Domain", placeholder: "yourcompany.atlassian.net" },
      { key: "email", label: "Email", placeholder: "you@yourcompany.com" },
      { key: "api_token", label: "API Token", placeholder: "••••••••••••", secret: true },
      { key: "project_key", label: "Project Key", placeholder: "SUPP" },
    ],
  },
  {
    id: "segment",
    name: "Segment",
    description: "Track conversation events and funnel data into your data warehouse.",
    category: "Analytics",
    icon: BarChart3,
    color: "#52bd94",
    type: "segment",
    fields: [
      { key: "write_key", label: "Write Key", placeholder: "••••••••••••", secret: true },
    ],
  },
  {
    id: "google_analytics",
    name: "Google Analytics",
    description: "Send chat engagement events to GA4 for attribution and funnel analysis.",
    category: "Analytics",
    icon: BarChart3,
    color: "#e37400",
    type: "google_analytics",
    fields: [
      { key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX" },
      { key: "api_secret", label: "API Secret", placeholder: "••••••••••••", secret: true },
    ],
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(MARKETPLACE.map((m) => m.category))).sort()];

interface ConnectDialogProps {
  item: MarketplaceItem;
  onClose: () => void;
  onConnected: (integration: ConnectedIntegration) => void;
}

function ConnectDialog({ item, onClose, onConnected }: ConnectDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, type: item.type, config: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onConnected(data.integration);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: item.color + "30" }}>
            <item.icon className="w-5 h-5" style={{ color: item.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Connect {item.name}</h3>
            <p className="text-xs text-muted-foreground">{item.category}</p>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          {item.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
              <Input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                value={values[f.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="bg-[#0a0a0a] border-white/10 text-sm"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-white/10">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            className="flex-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plug className="w-3.5 h-3.5 mr-1.5" />}
            {saving ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [connecting, setConnecting] = useState<MarketplaceItem | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => setConnected(d.integrations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectedTypes = new Set(connected.map((c) => c.type));

  const filtered = MARKETPLACE.filter((m) => {
    const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "All" || m.category === category;
    return matchesSearch && matchesCat;
  });

  async function handleDisconnect(id: string) {
    setDisconnecting(id);
    try {
      await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      setConnected((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Plug className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Integrations</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Connect your <span className="text-gradient">entire stack</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Sync CRMs, ticketing systems, messaging channels, and analytics tools.
            Your AI agents get richer context; your team gets less context-switching.
          </p>
        </motion.div>

        {/* Connected integrations strip */}
        {!loading && connected.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Connected ({connected.length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {connected.map((c) => {
                const meta = MARKETPLACE.find((m) => m.type === c.type);
                const Icon = meta?.icon ?? Plug;
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-[#141414] border border-green-500/20 rounded-xl text-sm">
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: (meta?.color ?? "#666") + "30" }}>
                      <Icon className="w-3 h-3" style={{ color: meta?.color ?? "#666" }} />
                    </div>
                    <span className="font-medium">{c.name}</span>
                    <Badge className="bg-green-500/10 text-green-500 text-[10px] border-0 h-4">Active</Badge>
                    <button
                      onClick={() => handleDisconnect(c.id)}
                      disabled={disconnecting === c.id}
                      className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      {disconnecting === c.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <X className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search integrations…"
              className="pl-10 bg-[#141414] border-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-[#c4a574]/20 text-[#c4a574]"
                    : "bg-[#141414] text-muted-foreground hover:text-foreground border border-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Marketplace grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((item, i) => {
            const isConnected = connectedTypes.has(item.type);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`bg-[#141414] border-white/5 hover:border-white/10 transition-all h-full ${isConnected ? "ring-1 ring-green-500/20" : ""}`}>
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: item.color + "20" }}
                        >
                          <item.icon className="w-5 h-5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {item.name}
                            {item.popular && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/20 text-[#c4a574]">Popular</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.category}</div>
                        </div>
                      </div>
                      {isConnected && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                    </div>

                    <p className="text-xs text-muted-foreground flex-1 mb-4 leading-relaxed">{item.description}</p>

                    <div className="flex gap-2">
                      {isConnected ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs border-white/10 h-7"
                            onClick={() => setConnecting(item)}
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Configure
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] h-7"
                          onClick={() => setConnecting(item)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Connect
                        </Button>
                      )}
                      {item.docsUrl && (
                        <a href={item.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/5 text-muted-foreground transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Plug className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No integrations match your search.</p>
          </div>
        )}

        {/* Security note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex items-start gap-3 p-4 rounded-xl bg-[#141414] border border-white/5"
        >
          <Lock className="w-4 h-4 text-[#c4a574] mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Credentials are encrypted at rest and never logged. Sierra only reads data needed to answer customer questions.
            OAuth tokens are refreshed automatically and revocable at any time.
          </p>
        </motion.div>
      </div>

      {/* Connect dialog */}
      <AnimatePresence>
        {connecting && (
          <ConnectDialog
            item={connecting}
            onClose={() => setConnecting(null)}
            onConnected={(integration) => setConnected((prev) => [...prev, integration])}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
