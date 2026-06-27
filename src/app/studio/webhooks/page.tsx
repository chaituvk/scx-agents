"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Webhook, Plus, Trash2, Check, X, RefreshCw, Copy, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALL_EVENTS = [
  "conversation.created",
  "conversation.closed",
  "conversation.assigned",
  "message.sent",
  "escalation.triggered",
  "escalation.resolved",
  "playbook.completed",
  "csat.submitted",
];

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  description: string | null;
  created_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  response_status: number | null;
  created_at: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ url: "", events: ALL_EVENTS, description: "" });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});

  useEffect(() => { fetchWebhooks(); }, []);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function createWebhook() {
    if (!form.url) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setAdding(false);
        setForm({ url: "", events: ALL_EVENTS, description: "" });
        fetchWebhooks();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    fetchWebhooks();
  }

  async function toggleStatus(hook: WebhookRow) {
    await fetch(`/api/webhooks/${hook.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: hook.status === "active" ? "disabled" : "active" }),
    });
    fetchWebhooks();
  }

  async function fetchDeliveries(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (deliveries[id]) return;
    const res = await fetch(`/api/webhooks/${id}/deliveries`);
    const data = await res.json();
    setDeliveries((prev) => ({ ...prev, [id]: data.deliveries ?? [] }));
  }

  function toggleEvent(event: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }));
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Webhook className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Webhooks</h1>
              <p className="text-muted-foreground text-sm">Receive real-time events in your systems</p>
            </div>
          </div>
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Endpoint
          </Button>
        </div>

        {adding && (
          <Card className="mb-6 border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">New Webhook Endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Endpoint URL</label>
                <Input
                  placeholder="https://your-app.com/webhooks/sierra"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Input
                  placeholder="e.g. Notify CRM on escalation"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Events to subscribe</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map((ev) => (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        form.events.includes(ev)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={createWebhook} disabled={!form.url || saving}>
                  {saving ? "Saving…" : "Create Endpoint"}
                </Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading…</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <Webhook className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No webhooks configured. Add an endpoint to receive events.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((hook) => (
              <motion.div
                key={hook.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm truncate">{hook.url}</span>
                          <Badge variant={hook.status === "active" ? "default" : "secondary"} className="text-xs">
                            {hook.status}
                          </Badge>
                        </div>
                        {hook.description && (
                          <p className="text-xs text-muted-foreground mb-2">{hook.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {hook.events.map((ev) => (
                            <span key={ev} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchDeliveries(hook.id)}
                          className="gap-1 text-xs"
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedId === hook.id ? "rotate-180" : ""}`} />
                          Logs
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(hook)}>
                          {hook.status === "active" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteWebhook(hook.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {expandedId === hook.id && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Recent Deliveries</p>
                        {!deliveries[hook.id] ? (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        ) : deliveries[hook.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground">No deliveries yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {deliveries[hook.id].slice(0, 10).map((d) => (
                              <div key={d.id} className="flex items-center gap-3 text-xs">
                                <span className={`w-16 ${d.status === "delivered" ? "text-green-500" : d.status === "failed" ? "text-red-500" : "text-yellow-500"}`}>
                                  {d.status}
                                </span>
                                <span className="text-muted-foreground w-36 truncate">{d.event_type}</span>
                                <span className="text-muted-foreground">{d.response_status ?? "—"}</span>
                                <span className="text-muted-foreground ml-auto">{new Date(d.created_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
