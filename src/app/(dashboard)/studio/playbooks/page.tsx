"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Plus, CheckCircle, Archive, Edit3, Trash2, ChevronDown,
  ChevronRight, Loader2, Sparkles, Shield, Zap, AlertCircle, X,
  MoreHorizontal, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Policy {
  text: string;
  severity: "critical" | "high" | "medium" | "low";
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  persona: string;
  topics: string[];
  instructions: string[];
  policies: Policy[];
  actions: string[];
  escalation_triggers: string[];
  end_message: string | null;
  model_tier: string;
  created_at: string;
  updated_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const BLANK: Partial<Playbook> = {
  name: "",
  description: "",
  persona: "",
  topics: [],
  instructions: [],
  policies: [],
  actions: [],
  escalation_triggers: [],
  end_message: "",
  model_tier: "reasoning",
  status: "draft",
};

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || values.includes(trimmed)) { setInput(""); return; }
    onChange([...values, trimmed]);
    setInput("");
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10 min-h-[40px]">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 text-foreground">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-400">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 min-w-24 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

function PolicyEditor({ policies, onChange }: { policies: Policy[]; onChange: (p: Policy[]) => void }) {
  const [input, setInput] = useState("");
  const [severity, setSeverity] = useState<Policy["severity"]>("medium");

  function add() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...policies, { text: trimmed, severity }]);
    setInput("");
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Policies</label>
      <div className="mt-1.5 space-y-1.5">
        {policies.map((p, i) => (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${SEVERITY_COLORS[p.severity]}`}>
            <Shield className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="flex-1">{p.text}</span>
            <span className="uppercase tracking-wider font-semibold text-[10px]">{p.severity}</span>
            <button onClick={() => onChange(policies.filter((_, j) => j !== i))} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Add a policy rule…"
            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as Policy["severity"])}
            className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Button size="sm" onClick={add} variant="outline" className="text-xs h-auto py-1.5">Add</Button>
        </div>
      </div>
    </div>
  );
}

function PlaybookForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<Playbook>;
  onSave: (data: Partial<Playbook>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [data, setData] = useState<Partial<Playbook>>(initial);
  const set = (k: keyof Playbook, v: unknown) => setData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name *</label>
          <input
            value={data.name ?? ""}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. E-commerce Support Playbook"
            className="mt-1.5 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model Tier</label>
          <select
            value={data.model_tier ?? "reasoning"}
            onChange={e => set("model_tier", e.target.value)}
            className="mt-1.5 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
          >
            <option value="fast">Fast (low latency)</option>
            <option value="reasoning">Reasoning (balanced)</option>
            <option value="premium">Premium (highest quality)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
        <textarea
          value={data.description ?? ""}
          onChange={e => set("description", e.target.value)}
          placeholder="What does this playbook handle?"
          rows={2}
          className="mt-1.5 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Persona</label>
        <textarea
          value={data.persona ?? ""}
          onChange={e => set("persona", e.target.value)}
          placeholder="Describe the AI agent's personality, tone, and identity. e.g. 'You are Aria, a friendly and knowledgeable support specialist for Acme Inc. You speak clearly, concisely, and always prioritize customer satisfaction.'"
          rows={3}
          className="mt-1.5 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
        />
      </div>

      <TagInput
        label="Topics (what this playbook handles)"
        values={data.topics ?? []}
        onChange={v => set("topics", v)}
        placeholder="e.g. refunds, shipping — press Enter"
      />

      <TagInput
        label="Instructions (natural language rules)"
        values={data.instructions ?? []}
        onChange={v => set("instructions", v)}
        placeholder="e.g. Always verify order number before processing — press Enter"
      />

      <PolicyEditor
        policies={(data.policies as Policy[]) ?? []}
        onChange={v => set("policies", v)}
      />

      <TagInput
        label="Available Actions"
        values={data.actions ?? []}
        onChange={v => set("actions", v)}
        placeholder="e.g. process_refund, send_tracking — press Enter"
      />

      <TagInput
        label="Escalation Triggers"
        values={data.escalation_triggers ?? []}
        onChange={v => set("escalation_triggers", v)}
        placeholder="e.g. customer is angry, fraud suspected — press Enter"
      />

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Message</label>
        <input
          value={data.end_message ?? ""}
          onChange={e => set("end_message", e.target.value)}
          placeholder="Message sent when conversation closes, e.g. 'Is there anything else I can help you with?'"
          className="mt-1.5 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={() => onSave(data)} disabled={saving || !data.name?.trim()} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {initial.id ? "Save Changes" : "Create Playbook"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function PlaybookCard({
  playbook,
  onActivate,
  onEdit,
  onDelete,
  activating,
}: {
  playbook: Playbook;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  activating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl overflow-hidden transition-colors ${
        playbook.status === "active" ? "border-[#c4a574]/40" : "border-border"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {playbook.status === "active" && <Star className="w-3.5 h-3.5 text-[#c4a574] fill-current" />}
              <h3 className="font-medium text-sm truncate">{playbook.name}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                playbook.status === "active" ? "bg-[#c4a574]/10 text-[#c4a574]" :
                playbook.status === "draft" ? "bg-white/5 text-muted-foreground" :
                "bg-white/5 text-muted-foreground/50"
              }`}>
                {playbook.status}
              </span>
            </div>
            {playbook.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{playbook.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(playbook.topics ?? []).slice(0, 5).map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{t}</span>
              ))}
              {(playbook.topics ?? []).length > 5 && (
                <span className="text-[10px] text-muted-foreground">+{playbook.topics.length - 5} more</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {playbook.status !== "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={onActivate}
                disabled={activating}
                className="text-xs h-7 gap-1 border-[#c4a574]/30 text-[#c4a574] hover:bg-[#c4a574]/10"
              >
                {activating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Activate
              </Button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4 space-y-3">
              {playbook.persona && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Persona</p>
                  <p className="text-xs text-foreground/80">{playbook.persona}</p>
                </div>
              )}
              {(playbook.instructions ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Instructions</p>
                  <ul className="space-y-1">
                    {playbook.instructions.map((ins, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-[#c4a574]" />
                        {ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(playbook.policies ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Policies</p>
                  <div className="space-y-1">
                    {(playbook.policies as Policy[]).map((p, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-xs p-1.5 rounded border ${SEVERITY_COLORS[p.severity]}`}>
                        <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{p.text}</span>
                        <span className="ml-auto text-[10px] font-semibold uppercase">{p.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(playbook.escalation_triggers ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Escalation Triggers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {playbook.escalation_triggers.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertCircle className="w-2.5 h-2.5 inline mr-1" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span>Model: {playbook.model_tier}</span>
                <span>·</span>
                <span>Updated {new Date(playbook.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playbooks");
      const data = await res.json();
      setPlaybooks(data.playbooks ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Playbook>) {
    setSaving(true);
    try {
      if (editing?.id) {
        await fetch(`/api/playbooks/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/playbooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setCreating(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setActivating(id);
    try {
      await fetch(`/api/playbooks/${id}/activate`, { method: "POST" });
      await load();
    } finally {
      setActivating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this playbook?")) return;
    await fetch(`/api/playbooks/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = playbooks.filter(p => filter === "all" || p.status === filter);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Playbooks</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Natural language instructions that shape how your AI agent thinks, speaks, and acts.
          </p>
        </div>
        <Button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          <Plus className="w-4 h-4" />
          New Playbook
        </Button>
      </div>

      {/* Create / Edit form */}
      <AnimatePresence>
        {(creating || editing) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#c4a574]" />
                {editing ? "Edit Playbook" : "New Playbook"}
              </h2>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <PlaybookForm
              initial={editing ?? BLANK}
              onSave={handleSave}
              onCancel={() => { setCreating(false); setEditing(null); }}
              saving={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "active", "draft", "archived"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
              filter === f ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
            {f === "all" ? ` (${playbooks.length})` :
             ` (${playbooks.filter(p => p.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ScrollText className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No playbooks yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first playbook to start shaping your AI&apos;s behavior.</p>
          <Button
            size="sm"
            className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]"
            onClick={() => setCreating(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> Create Playbook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PlaybookCard
              key={p.id}
              playbook={p}
              onActivate={() => handleActivate(p.id)}
              onEdit={() => { setEditing(p); setCreating(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              onDelete={() => handleDelete(p.id)}
              activating={activating === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
