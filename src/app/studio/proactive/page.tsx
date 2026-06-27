"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  Edit3,
  Trash2,
  Clock,
  MousePointer,
  ArrowUp,
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TriggerType = "page_dwell" | "exit_intent" | "scroll_depth" | "return_visitor" | "custom";

interface ProactiveTrigger {
  id: string;
  name: string;
  status: "active" | "inactive";
  trigger_type: TriggerType;
  conditions: Record<string, unknown>;
  message: string;
  delay_seconds: number;
  cooldown_hours: number;
  priority: number;
  created_at?: string;
}

const TRIGGER_ICONS: Record<TriggerType, React.ElementType> = {
  page_dwell: Clock,
  exit_intent: MousePointer,
  scroll_depth: ArrowUp,
  return_visitor: RefreshCw,
  custom: Zap,
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  page_dwell: "Page Dwell",
  exit_intent: "Exit Intent",
  scroll_depth: "Scroll Depth",
  return_visitor: "Return Visitor",
  custom: "Custom",
};

const TRIGGER_DESCS: Record<TriggerType, string> = {
  page_dwell: "Fire after visitor stays on a page for N seconds",
  exit_intent: "Fire when visitor moves mouse toward closing the tab",
  scroll_depth: "Fire after visitor scrolls past a percentage of the page",
  return_visitor: "Fire when a visitor returns after a previous visit",
  custom: "Custom condition evaluated by the widget",
};

interface TriggerFormProps {
  initial?: Partial<ProactiveTrigger>;
  onSave: (trigger: ProactiveTrigger) => void;
  onCancel: () => void;
}

function TriggerForm({ initial, onSave, onCancel }: TriggerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.trigger_type ?? "page_dwell");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [delaySeconds, setDelaySeconds] = useState(initial?.delay_seconds ?? 30);
  const [cooldownHours, setCooldownHours] = useState(initial?.cooldown_hours ?? 24);
  const [scrollPct, setScrollPct] = useState((initial?.conditions as {scroll_pct?: number})?.scroll_pct ?? 50);
  const [visitCount, setVisitCount] = useState((initial?.conditions as {min_visits?: number})?.min_visits ?? 2);
  const [pagePattern, setPagePattern] = useState((initial?.conditions as {page_pattern?: string})?.page_pattern ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    const conditions: Record<string, unknown> = {};
    if (triggerType === "scroll_depth") conditions.scroll_pct = scrollPct;
    if (triggerType === "return_visitor") conditions.min_visits = visitCount;
    if (pagePattern.trim()) conditions.page_pattern = pagePattern.trim();

    const isEdit = !!initial?.id;
    const url = isEdit ? `/api/proactive-triggers/${initial!.id}` : "/api/proactive-triggers";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          trigger_type: triggerType,
          message: message.trim(),
          conditions,
          delay_seconds: delaySeconds,
          cooldown_hours: cooldownHours,
          status: initial?.status ?? "active",
        }),
      });
      const data = await res.json();
      if (res.ok) onSave(data.trigger);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-base mb-5">
          {initial?.id ? "Edit Trigger" : "New Proactive Trigger"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Trigger Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pricing page offer" className="bg-[#0a0a0a] border-white/10" />
          </div>

          {/* Trigger type selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Trigger Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => {
                const Icon = TRIGGER_ICONS[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTriggerType(t)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      triggerType === t
                        ? "border-[#c4a574]/50 bg-[#c4a574]/10 text-[#c4a574]"
                        : "border-white/5 bg-[#0a0a0a] text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {TRIGGER_LABELS[t]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{TRIGGER_DESCS[triggerType]}</p>
          </div>

          {/* Condition-specific fields */}
          {triggerType === "page_dwell" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fire after (seconds on page)</label>
              <Input type="number" min="5" max="300" value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} className="bg-[#0a0a0a] border-white/10 w-32" />
            </div>
          )}
          {triggerType === "scroll_depth" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Scroll depth threshold (%)</label>
              <Input type="number" min="10" max="100" value={scrollPct} onChange={(e) => setScrollPct(Number(e.target.value))} className="bg-[#0a0a0a] border-white/10 w-32" />
            </div>
          )}
          {triggerType === "return_visitor" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Minimum visit count</label>
              <Input type="number" min="2" max="20" value={visitCount} onChange={(e) => setVisitCount(Number(e.target.value))} className="bg-[#0a0a0a] border-white/10 w-32" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Page URL pattern (optional)</label>
            <Input value={pagePattern} onChange={(e) => setPagePattern(e.target.value)} placeholder="e.g. /pricing or /checkout" className="bg-[#0a0a0a] border-white/10" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message to send</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Hi there! Looks like you're exploring our pricing. Can I help you find the right plan?"
              rows={3}
              className="text-sm bg-[#0a0a0a] border-white/10 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cooldown (hours)</label>
              <Input type="number" min="1" max="168" value={cooldownHours} onChange={(e) => setCooldownHours(Number(e.target.value))} className="bg-[#0a0a0a] border-white/10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority (lower = higher)</label>
              <Input type="number" min="1" value={100} className="bg-[#0a0a0a] border-white/10" readOnly />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button onClick={onCancel} variant="outline" size="sm" className="flex-1 border-white/10">Cancel</Button>
          <Button
            onClick={handleSave}
            size="sm"
            className="flex-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
            disabled={!name.trim() || !message.trim() || saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
            {saving ? "Saving…" : initial?.id ? "Update" : "Create"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ProactiveTriggersPage() {
  const [triggers, setTriggers] = useState<ProactiveTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProactiveTrigger | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/proactive-triggers")
      .then((r) => r.json())
      .then((d) => setTriggers(d.triggers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleStatus(trigger: ProactiveTrigger) {
    setTogglingId(trigger.id);
    const newStatus = trigger.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/proactive-triggers/${trigger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTriggers((prev) => prev.map((t) => t.id === trigger.id ? { ...t, status: newStatus } : t));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteTrigger(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/proactive-triggers/${id}`, { method: "DELETE" });
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const activeTriggers = triggers.filter((t) => t.status === "active");

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Proactive Engagement</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight mb-2">
                Proactive <span className="text-gradient">Triggers</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-xl">
                Engage visitors before they leave. Set behavioral triggers — page dwell, exit intent,
                scroll depth, or return visits — to open a chat with a personalized message.
              </p>
            </div>
            <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              New Trigger
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-400">{activeTriggers.length}</p>
              <p className="text-xs text-muted-foreground">Active Triggers</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold">{triggers.length}</p>
              <p className="text-xs text-muted-foreground">Total Defined</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-[#c4a574]">{triggers.filter((t) => t.trigger_type === "exit_intent").length}</p>
              <p className="text-xs text-muted-foreground">Exit Intent</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Trigger list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : triggers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No triggers yet.</p>
            <p className="text-xs mt-1">Create one to start proactively engaging visitors.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {triggers.sort((a, b) => a.priority - b.priority).map((trigger) => {
              const Icon = TRIGGER_ICONS[trigger.trigger_type];
              return (
                <Card key={trigger.id} className={`bg-[#141414] border-white/5 ${trigger.status === "active" ? "ring-1 ring-green-500/10" : "opacity-60"}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${trigger.status === "active" ? "bg-[#c4a574]/20" : "bg-white/5"}`}>
                        <Icon className={`w-4 h-4 ${trigger.status === "active" ? "text-[#c4a574]" : "text-muted-foreground"}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{trigger.name}</span>
                          <Badge className={trigger.status === "active" ? "bg-green-500/20 text-green-400 border-0 text-[10px]" : "bg-gray-500/20 text-gray-400 border-0 text-[10px]"}>
                            {trigger.status}
                          </Badge>
                          <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px]">
                            {TRIGGER_LABELS[trigger.trigger_type]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{trigger.message}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {trigger.trigger_type === "page_dwell" && <span><Clock className="w-3 h-3 inline mr-0.5" />{trigger.delay_seconds}s dwell</span>}
                          <span>Cooldown: {trigger.cooldown_hours}h</span>
                          <span>Priority: {trigger.priority}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleStatus(trigger)}
                          disabled={togglingId === trigger.id}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={trigger.status === "active" ? "Pause trigger" : "Enable trigger"}
                        >
                          {togglingId === trigger.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : trigger.status === "active"
                            ? <EyeOff className="w-4 h-4" />
                            : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditing(trigger)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTrigger(trigger.id)}
                          disabled={deletingId === trigger.id}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          {deletingId === trigger.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 p-5 bg-[#141414] border border-white/5 rounded-2xl"
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#c4a574]" /> Trigger priority order
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When multiple triggers match at once, only the highest-priority one fires per session load.
            Cooldowns are stored per-visitor in localStorage and reset after the cooldown period.
            Use lower priority numbers for more important triggers (e.g. priority 1 fires before priority 100).
          </p>
        </motion.div>
      </div>

      <AnimatePresence>
        {creating && (
          <TriggerForm
            onCancel={() => setCreating(false)}
            onSave={(trigger) => {
              setTriggers((prev) => [...prev, trigger]);
              setCreating(false);
            }}
          />
        )}
        {editing && (
          <TriggerForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={(updated) => {
              setTriggers((prev) => prev.map((t) => t.id === updated.id ? updated : t));
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
