"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, Play, Trash2, ChevronRight, ChevronDown,
  Mail, MessageSquare, Phone, Clock, CheckCircle, XCircle, Loader2,
  Users, Send, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "scheduled" | "running" | "completed" | "paused" | "failed";
  channel: "sms" | "whatsapp" | "email";
  message_template?: string;
  use_ai_personalization: boolean;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  reply_count: number;
  created_at: string;
}

interface CampaignContact {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  status: "pending" | "sent" | "delivered" | "failed";
  sent_at?: string;
  error?: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  sms: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:     { label: "Draft",     variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
  running:   { label: "Running",   variant: "default" },
  completed: { label: "Completed", variant: "default" },
  paused:    { label: "Paused",    variant: "secondary" },
  failed:    { label: "Failed",    variant: "destructive" },
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  pending:   "text-muted-foreground",
  sent:      "text-blue-500",
  delivered: "text-green-500",
  failed:    "text-destructive",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    channel: "sms" as Campaign["channel"],
    message_template: "",
    use_ai_personalization: false,
    scheduled_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const fetchContacts = useCallback(async (campaignId: string) => {
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts ?? []);
      }
    } finally {
      setContactsLoading(false);
    }
  }, []);

  function selectCampaign(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setContacts([]);
    } else {
      setSelectedId(id);
      fetchContacts(id);
    }
  }

  async function createCampaign() {
    if (!form.name.trim()) { setFormError("Name is required"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          channel: form.channel,
          message_template: form.message_template || undefined,
          use_ai_personalization: form.use_ai_personalization,
          scheduled_at: form.scheduled_at || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: "", description: "", channel: "sms", message_template: "", use_ai_personalization: false, scheduled_at: "" });
        fetchCampaigns();
      } else {
        const data = await res.json();
        setFormError(data.error ?? "Failed to create campaign");
      }
    } finally {
      setSaving(false);
    }
  }

  async function launchCampaign(campaignId: string) {
    setLaunching(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, { method: "POST" });
      if (res.ok) {
        fetchCampaigns();
      }
    } finally {
      setLaunching(null);
    }
  }

  async function deleteCampaign(campaignId: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setDeleting(campaignId);
    try {
      await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (selectedId === campaignId) { setSelectedId(null); setContacts([]); }
      fetchCampaigns();
    } finally {
      setDeleting(null);
    }
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Campaigns</h1>
              <p className="text-muted-foreground text-sm">Proactive outbound messaging to your customers</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </div>

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-background rounded-xl border shadow-xl w-full max-w-lg p-6"
              >
                <h2 className="text-lg font-semibold mb-4">Create Campaign</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Name *</label>
                    <Input
                      placeholder="e.g. Spring Promo — SMS Blast"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <Input
                      placeholder="Optional description"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Channel</label>
                    <div className="flex gap-2">
                      {(["sms", "whatsapp", "email"] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, channel: ch }))}
                          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border transition-colors capitalize ${
                            form.channel === ch
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-foreground"
                          }`}
                        >
                          {CHANNEL_ICONS[ch]} {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Message Template
                      <span className="text-muted-foreground font-normal ml-1 text-xs">(use {"{{name}}"}, {"{{key}}"} for variables)</span>
                    </label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Hi {{name}}, we have a special offer just for you…"
                      value={form.message_template}
                      onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="ai-personalize"
                      type="checkbox"
                      className="rounded"
                      checked={form.use_ai_personalization}
                      onChange={(e) => setForm((f) => ({ ...f, use_ai_personalization: e.target.checked }))}
                    />
                    <label htmlFor="ai-personalize" className="text-sm cursor-pointer">
                      Use AI personalization (generate unique message per contact)
                    </label>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Schedule (optional)</label>
                    <Input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                    />
                  </div>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={createCampaign} disabled={!form.name || saving}>
                      {saving ? "Creating…" : "Create Campaign"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowCreate(false); setFormError(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Campaign list */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-muted-foreground py-24">
            <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Create your first campaign to start reaching customers.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isExpanded = selectedId === campaign.id;
              const statusInfo = STATUS_BADGE[campaign.status] ?? { label: campaign.status, variant: "secondary" as const };
              const deliveryRate = campaign.sent_count > 0
                ? Math.round((campaign.delivered_count / campaign.sent_count) * 100)
                : 0;

              return (
                <motion.div key={campaign.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={isExpanded ? "border-primary/50 shadow-sm" : ""}>
                    <CardContent className="p-0">
                      {/* Campaign row */}
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                        onClick={() => selectCampaign(campaign.id)}
                      >
                        <div className="shrink-0">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{campaign.name}</span>
                            <Badge variant={statusInfo.variant} className="text-xs shrink-0">{statusInfo.label}</Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize shrink-0">
                              {CHANNEL_ICONS[campaign.channel]} {campaign.channel}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {campaign.total_contacts} contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" /> {campaign.sent_count} sent
                            </span>
                            {campaign.delivered_count > 0 && (
                              <span className="flex items-center gap-1 text-green-500">
                                <CheckCircle className="w-3 h-3" /> {campaign.delivered_count} delivered
                              </span>
                            )}
                            {campaign.failed_count > 0 && (
                              <span className="flex items-center gap-1 text-destructive">
                                <XCircle className="w-3 h-3" /> {campaign.failed_count} failed
                              </span>
                            )}
                            {campaign.scheduled_at && campaign.status === "scheduled" && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(campaign.scheduled_at).toLocaleString()}
                              </span>
                            )}
                            {campaign.use_ai_personalization && (
                              <span className="text-primary">AI personalized</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {["draft", "scheduled", "paused"].includes(campaign.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              disabled={launching === campaign.id}
                              onClick={() => launchCampaign(campaign.id)}
                            >
                              {launching === campaign.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Play className="w-3.5 h-3.5" />}
                              Launch
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deleting === campaign.id || campaign.status === "running"}
                            onClick={() => deleteCampaign(campaign.id)}
                          >
                            {deleting === campaign.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t"
                          >
                            <div className="p-4 space-y-4">
                              {/* Stats bar */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                  { label: "Total", value: campaign.total_contacts, icon: <Users className="w-4 h-4" />, color: "text-foreground" },
                                  { label: "Sent", value: campaign.sent_count, icon: <Send className="w-4 h-4" />, color: "text-blue-500" },
                                  { label: "Delivered", value: campaign.delivered_count, icon: <CheckCircle className="w-4 h-4" />, color: "text-green-500" },
                                  { label: "Failed", value: campaign.failed_count, icon: <XCircle className="w-4 h-4" />, color: "text-destructive" },
                                ].map((stat) => (
                                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
                                    <span className={stat.color}>{stat.icon}</span>
                                    <div>
                                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                                      <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Delivery rate bar */}
                              {campaign.sent_count > 0 && (
                                <div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                    <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Delivery rate</span>
                                    <span>{deliveryRate}%</span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full transition-all"
                                      style={{ width: `${deliveryRate}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Message template preview */}
                              {campaign.message_template && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Message Template</p>
                                  <p className="text-sm bg-muted/30 rounded p-2 whitespace-pre-wrap">{campaign.message_template}</p>
                                </div>
                              )}

                              {/* Contacts table */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Contacts</p>
                                {contactsLoading ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading contacts…
                                  </div>
                                ) : contacts.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-4 text-center">
                                    No contacts added yet.
                                  </div>
                                ) : (
                                  <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/50">
                                        <tr>
                                          <th className="text-left p-2 font-medium">Name</th>
                                          <th className="text-left p-2 font-medium">Contact</th>
                                          <th className="text-left p-2 font-medium">Status</th>
                                          <th className="text-left p-2 font-medium">Sent</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {contacts.map((contact, idx) => (
                                          <tr key={contact.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                            <td className="p-2">{contact.name ?? "—"}</td>
                                            <td className="p-2 text-muted-foreground">{contact.phone ?? contact.email ?? "—"}</td>
                                            <td className={`p-2 font-medium ${CONTACT_STATUS_COLORS[contact.status]}`}>
                                              {contact.status}
                                              {contact.error && (
                                                <span className="text-muted-foreground font-normal ml-1">({contact.error})</span>
                                              )}
                                            </td>
                                            <td className="p-2 text-muted-foreground">
                                              {contact.sent_at ? new Date(contact.sent_at).toLocaleString() : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {campaign.total_contacts > contacts.length && (
                                      <div className="text-xs text-center text-muted-foreground p-2 border-t">
                                        Showing {contacts.length} of {campaign.total_contacts} contacts
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
