"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Webhook, Plus, Loader2, X, CheckCircle, Trash2, ChevronDown,
  Globe, AlertCircle, Clock, Copy, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebhookItem {
  id: string;
  url: string;
  description?: string;
  events: string[];
  status: "active" | "inactive" | "failing";
  last_triggered_at?: string;
  failure_count?: number;
  created_at: string;
}

interface Delivery {
  id: string;
  event: string;
  status: number;
  duration_ms: number;
  delivered_at: string;
}

const ALL_EVENTS = [
  "conversation.created",
  "conversation.closed",
  "conversation.escalated",
  "message.received",
  "message.sent",
  "handover.accepted",
  "handover.rejected",
  "csat.submitted",
  "playbook.activated",
  "knowledge.gap.detected",
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-400",
  inactive: "bg-white/5 text-muted-foreground",
  failing: "bg-red-500/10 text-red-400",
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Map<string, Delivery[]>>(new Map());
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", description: "", events: [] as string[] });
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url.trim(),
          description: form.description.trim() || undefined,
          events: form.events.length > 0 ? form.events : ALL_EVENTS,
        }),
      });
      if (res.ok) {
        setCreating(false);
        setForm({ url: "", description: "", events: [] });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadDeliveries(webhookId: string) {
    setLoadingDeliveries(webhookId);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(prev => new Map(prev).set(webhookId, data.deliveries ?? []));
      }
    } finally {
      setLoadingDeliveries(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" }).catch(() => {});
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  function toggleEvent(event: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter(e => e !== event)
        : [...f.events, event],
    }));
  }

  function copyUrl(url: string, id: string) {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Webhook className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Webhooks</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Send real-time event notifications to your systems when things happen in Sierra.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
          <Plus className="w-4 h-4" /> Add Webhook
        </Button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">New Webhook</h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Endpoint URL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://your-server.com/webhooks/sierra"
                  type="url"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Slack escalation notifier"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Events (leave empty for all)</label>
                  {form.events.length > 0 && (
                    <button onClick={() => setForm(f => ({ ...f, events: [] }))} className="text-[10px] text-muted-foreground hover:text-foreground">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_EVENTS.map(ev => (
                    <button
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors font-mono ${
                        form.events.includes(ev) || form.events.length === 0
                          ? "bg-[#c4a574]/10 text-[#c4a574] border-[#c4a574]/30"
                          : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/20"
                      }`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.url.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Webhook
                </Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Webhook className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No webhooks configured</p>
          <p className="text-xs text-muted-foreground mt-1">Connect Sierra events to your CRM, ticketing system, or custom workflows.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => {
            const isExpanded = expanded === wh.id;
            const whDeliveries = deliveries.get(wh.id);
            return (
              <motion.div
                key={wh.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className="p-4 flex items-start gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono text-foreground truncate max-w-xs">{wh.url}</code>
                      <button
                        onClick={() => copyUrl(wh.url, wh.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Copy className={`w-3 h-3 ${copied === wh.id ? "text-green-400" : ""}`} />
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[wh.status ?? "active"]}`}>
                        {wh.status ?? "active"}
                      </span>
                    </div>
                    {wh.description && <p className="text-xs text-muted-foreground">{wh.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(wh.events ?? []).slice(0, 5).map(ev => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">
                          {ev}
                        </span>
                      ))}
                      {(wh.events ?? []).length > 5 && (
                        <span className="text-[10px] text-muted-foreground">+{wh.events.length - 5} more</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        const next = isExpanded ? null : wh.id;
                        setExpanded(next);
                        if (next && !deliveries.has(wh.id)) loadDeliveries(wh.id);
                      }}
                      className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <button onClick={() => handleDelete(wh.id)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-medium">Recent Deliveries</p>
                          <button
                            onClick={() => loadDeliveries(wh.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {loadingDeliveries === wh.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {loadingDeliveries === wh.id ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : !whDeliveries || whDeliveries.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No deliveries yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {whDeliveries.slice(0, 8).map(d => (
                              <div key={d.id} className="flex items-center gap-3 text-xs">
                                <span className={`w-8 text-right font-mono font-medium ${d.status >= 200 && d.status < 300 ? "text-green-400" : "text-red-400"}`}>
                                  {d.status}
                                </span>
                                <span className="text-muted-foreground font-mono">{d.event}</span>
                                <span className="text-muted-foreground ml-auto">{d.duration_ms}ms</span>
                                <span className="text-muted-foreground/60">
                                  {new Date(d.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
