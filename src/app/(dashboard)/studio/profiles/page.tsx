"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Plus, Loader2, X, CheckCircle, Trash2, ChevronDown,
  Shield, Cpu, GitBranch, ScrollText, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ProfileKind = "router" | "specialist" | "policy" | "guardrail";
type ProfileStatus = "active" | "draft" | "archived";

interface PolicyRule {
  id: string;
  description?: string;
  effect: "allow" | "deny" | "require_approval" | "escalate";
  when: {
    op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists";
    var: string;
    value?: string | number | boolean;
  };
  reason?: string;
}

interface RuntimeProfile {
  id: string;
  name: string;
  kind: ProfileKind;
  status: ProfileStatus;
  description?: string;
  allowed_journeys?: string[];
  allowed_tools?: string[];
  allowed_slots?: string[];
  guardrails?: string[];
  policies?: PolicyRule[];
  created_at: string;
}

interface ProfileForm {
  name: string;
  kind: ProfileKind;
  status: ProfileStatus;
  description: string;
  allowed_journeys: string[];
  allowed_tools: string[];
  allowed_slots: string[];
}

const BLANK: ProfileForm = {
  name: "",
  kind: "specialist",
  status: "active",
  description: "",
  allowed_journeys: [],
  allowed_tools: [],
  allowed_slots: [],
};

const KIND_ICONS: Record<ProfileKind, React.ElementType> = {
  router: GitBranch,
  specialist: Cpu,
  policy: ScrollText,
  guardrail: Shield,
};

const KIND_COLORS: Record<ProfileKind, string> = {
  router: "text-blue-400 bg-blue-500/10",
  specialist: "text-[#c4a574] bg-[#c4a574]/10",
  policy: "text-purple-400 bg-purple-500/10",
  guardrail: "text-green-400 bg-green-500/10",
};

function ListInput({ label, values, onChange, placeholder }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t || values.includes(t)) { setInput(""); return; }
    onChange([...values, t]);
    setInput("");
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10 min-h-[38px]">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 text-foreground font-mono">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-400 text-muted-foreground">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 min-w-20 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<RuntimeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(BLANK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runtime/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/runtime/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  async function toggleStatus(p: RuntimeProfile) {
    const newStatus: ProfileStatus = p.status === "active" ? "draft" : "active";
    await fetch(`/api/runtime/profiles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    setProfiles(prev => prev.map(r => r.id === p.id ? { ...r, status: newStatus } : r));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this profile?")) return;
    await fetch(`/api/runtime/profiles/${id}`, { method: "DELETE" }).catch(() => {});
    setProfiles(prev => prev.filter(p => p.id !== id));
  }

  const activeCount = profiles.filter(p => p.status === "active").length;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Runtime Profiles</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure which journeys, tools, and policies each agent role can access at runtime.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
          <Plus className="w-4 h-4" /> New Profile
        </Button>
      </div>

      {!loading && profiles.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
          <span><span className="text-green-400 font-medium">{activeCount}</span> active</span>
          <span>·</span>
          <span><span className="text-foreground font-medium">{profiles.length}</span> total</span>
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
              <h2 className="font-medium">New Runtime Profile</h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Billing Specialist"
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Kind</label>
                  <select
                    value={form.kind}
                    onChange={e => setForm(f => ({ ...f, kind: e.target.value as ProfileKind }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  >
                    <option value="specialist">Specialist</option>
                    <option value="router">Router</option>
                    <option value="policy">Policy</option>
                    <option value="guardrail">Guardrail</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ProfileStatus }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this profile govern?"
                  rows={2}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>
              <ListInput
                label="Allowed Journeys (leave empty = all)"
                values={form.allowed_journeys}
                onChange={v => setForm(f => ({ ...f, allowed_journeys: v }))}
                placeholder="journey-id — press Enter"
              />
              <ListInput
                label="Allowed Tools (leave empty = all)"
                values={form.allowed_tools}
                onChange={v => setForm(f => ({ ...f, allowed_tools: v }))}
                placeholder="tool-name — press Enter"
              />
              <ListInput
                label="Allowed Slots (leave empty = all)"
                values={form.allowed_slots}
                onChange={v => setForm(f => ({ ...f, allowed_slots: v }))}
                placeholder="slot-name — press Enter"
              />
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Profile
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
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Settings className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No runtime profiles</p>
          <p className="text-xs text-muted-foreground mt-1">Create profiles to control what each agent role can access and do at runtime.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Profile
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => {
            const Icon = KIND_ICONS[profile.kind];
            const isExpanded = expanded === profile.id;
            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleStatus(profile)} className="mt-0.5 shrink-0">
                    {profile.status === "active" ? (
                      <ToggleRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className={`p-1.5 rounded-lg shrink-0 ${KIND_COLORS[profile.kind]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium">{profile.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground capitalize">{profile.kind}</span>
                      {profile.status === "draft" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">Draft</span>
                      )}
                    </div>
                    {profile.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      {profile.allowed_journeys && profile.allowed_journeys.length > 0 ? (
                        <span>{profile.allowed_journeys.length} journey{profile.allowed_journeys.length !== 1 ? "s" : ""}</span>
                      ) : (
                        <span className="text-green-400/60">all journeys</span>
                      )}
                      <span>·</span>
                      {profile.allowed_tools && profile.allowed_tools.length > 0 ? (
                        <span>{profile.allowed_tools.length} tool{profile.allowed_tools.length !== 1 ? "s" : ""}</span>
                      ) : (
                        <span className="text-green-400/60">all tools</span>
                      )}
                      {profile.policies && profile.policies.length > 0 && (
                        <><span>·</span><span>{profile.policies.length} polic{profile.policies.length !== 1 ? "ies" : "y"}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : profile.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <button onClick={() => handleDelete(profile.id)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
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
                      <div className="border-t border-border p-4 space-y-3">
                        {profile.allowed_journeys && profile.allowed_journeys.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Allowed Journeys</p>
                            <div className="flex flex-wrap gap-1">
                              {profile.allowed_journeys.map(j => (
                                <span key={j} className="text-xs px-2 py-0.5 rounded bg-white/5 text-foreground font-mono">{j}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {profile.allowed_tools && profile.allowed_tools.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Allowed Tools</p>
                            <div className="flex flex-wrap gap-1">
                              {profile.allowed_tools.map(t => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded bg-white/5 text-foreground font-mono">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {profile.policies && profile.policies.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Policy Rules</p>
                            <div className="space-y-1.5">
                              {profile.policies.map(rule => (
                                <div key={rule.id} className="flex items-center gap-2 text-xs bg-black/20 rounded-lg px-3 py-2">
                                  <span className={`font-medium ${rule.effect === "allow" ? "text-green-400" : rule.effect === "deny" ? "text-red-400" : rule.effect === "escalate" ? "text-orange-400" : "text-yellow-400"}`}>
                                    {rule.effect}
                                  </span>
                                  <span className="text-muted-foreground">when</span>
                                  <code className="text-[#c4a574]">{rule.when.var}</code>
                                  <span className="text-muted-foreground">{rule.when.op}</span>
                                  {rule.when.value !== undefined && (
                                    <code className="text-foreground">{String(rule.when.value)}</code>
                                  )}
                                  {rule.reason && <span className="text-muted-foreground ml-auto">· {rule.reason}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(!profile.allowed_journeys || profile.allowed_journeys.length === 0) &&
                         (!profile.allowed_tools || profile.allowed_tools.length === 0) &&
                         (!profile.policies || profile.policies.length === 0) && (
                          <p className="text-xs text-muted-foreground">No restrictions — this profile allows all journeys, tools, and has no policy rules.</p>
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
