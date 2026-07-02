"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Loader2, X, CheckCircle, Trash2, ToggleLeft, ToggleRight,
  Clock, MessageSquare, Eye, MousePointer, ArrowUpDown, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProactiveTrigger {
  id: string;
  name: string;
  status: "active" | "inactive";
  trigger_type: "page_dwell" | "exit_intent" | "scroll_depth" | "return_visitor" | "custom";
  conditions: Record<string, unknown>;
  message: string;
  playbook_id?: string;
  delay_seconds: number;
  cooldown_hours: number;
  priority: number;
  created_at: string;
}

const TRIGGER_TYPE_ICONS: Record<string, React.ElementType> = {
  page_dwell: Clock,
  exit_intent: MousePointer,
  scroll_depth: ArrowUpDown,
  return_visitor: Users,
  custom: Zap,
};

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  page_dwell: "Page Dwell",
  exit_intent: "Exit Intent",
  scroll_depth: "Scroll Depth",
  return_visitor: "Return Visitor",
  custom: "Custom",
};

interface TriggerForm {
  name: string;
  message: string;
  trigger_type: ProactiveTrigger["trigger_type"];
  delay_seconds: number;
  cooldown_hours: number;
  priority: number;
  conditions: Record<string, unknown>;
}

const BLANK: TriggerForm = {
  name: "",
  message: "",
  trigger_type: "page_dwell",
  delay_seconds: 30,
  cooldown_hours: 24,
  priority: 100,
  conditions: {},
};

export default function ProactivePage() {
  const [triggers, setTriggers] = useState<ProactiveTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TriggerForm>(BLANK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proactive-triggers");
      if (res.ok) {
        const data = await res.json();
        setTriggers(data.triggers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/proactive-triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "active" }),
      });
      if (res.ok) {
        setCreating(false);
        setForm(BLANK);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(t: ProactiveTrigger) {
    const newStatus = t.status === "active" ? "inactive" : "active";
    await fetch(`/api/proactive-triggers/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    setTriggers(prev => prev.map(r => r.id === t.id ? { ...r, status: newStatus } : r));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this trigger?")) return;
    await fetch(`/api/proactive-triggers/${id}`, { method: "DELETE" }).catch(() => {});
    setTriggers(prev => prev.filter(t => t.id !== id));
  }

  const activeCount = triggers.filter(t => t.status === "active").length;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Proactive Triggers</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically reach out to visitors based on behavioral signals before they ask for help.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
          <Plus className="w-4 h-4" /> New Trigger
        </Button>
      </div>

      {!loading && triggers.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
          <span><span className="text-green-400 font-medium">{activeCount}</span> active</span>
          <span>·</span>
          <span><span className="text-foreground font-medium">{triggers.length}</span> total</span>
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-medium">New Proactive Trigger</h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Pricing page nudge"
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Trigger Type</label>
                  <select
                    value={form.trigger_type}
                    onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as ProactiveTrigger["trigger_type"] }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  >
                    {Object.entries(TRIGGER_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Message *</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Hi! I noticed you've been exploring our pricing. Can I help answer any questions?"
                  rows={2}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Delay (seconds)</label>
                  <input
                    type="number"
                    value={form.delay_seconds}
                    onChange={e => setForm(f => ({ ...f, delay_seconds: parseInt(e.target.value) || 30 }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cooldown (hours)</label>
                  <input
                    type="number"
                    value={form.cooldown_hours}
                    onChange={e => setForm(f => ({ ...f, cooldown_hours: parseInt(e.target.value) || 24 }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Priority</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 100 }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || !form.message.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Trigger
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
      ) : triggers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Zap className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No proactive triggers</p>
          <p className="text-xs text-muted-foreground mt-1">Set up triggers to proactively engage visitors before they leave.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Trigger
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map(t => {
            const Icon = TRIGGER_TYPE_ICONS[t.trigger_type] ?? Zap;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${t.status === "active" ? "border-green-500/20" : "border-border opacity-60"}`}
              >
                <button onClick={() => toggleStatus(t)} className="mt-0.5 shrink-0">
                  {t.status === "active" ? (
                    <ToggleRight className="w-5 h-5 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-1.5 rounded-lg bg-[#c4a574]/10 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#c4a574]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{t.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                        {TRIGGER_TYPE_LABELS[t.trigger_type]}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 mb-1.5 line-clamp-2">&ldquo;{t.message}&rdquo;</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {t.delay_seconds}s delay</span>
                      <span>·</span>
                      <span>{t.cooldown_hours}h cooldown</span>
                      <span>·</span>
                      <span>Priority {t.priority}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
