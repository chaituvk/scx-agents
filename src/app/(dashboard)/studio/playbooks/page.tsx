"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Plus, CheckCircle, Archive, Loader2, Sparkles,
  Shield, Zap, X, Star, Play, Send, ChevronDown, ChevronUp,
  Code, Clock, RefreshCw, Trash2, ShoppingBag, CreditCard,
  Package, Truck, Tag, BookOpen, Users, Brain, Lock,
  Terminal, Eye, EyeOff, ArrowUp, ArrowDown, GripVertical,
  AlertTriangle, Check, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────

interface PlaybookPolicy {
  text: string;
  severity: "hard" | "soft";
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  persona: string;
  topics: string[];
  instructions: string[];
  policies: PlaybookPolicy[];
  actions: string[];
  escalation_triggers: string[];
  end_message?: string | null;
  model_tier?: string;
  created_at: string;
  updated_at?: string;
}

interface PlaybookVersion {
  id: string;
  version: number;
  change_summary?: string;
  created_by?: string;
  created_at: string;
  snapshot: Playbook;
}

interface TestMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: { tool: string; params: Record<string, unknown>; result?: unknown }[];
  thinking?: string[];
}

// ─── Tool catalogue (mirrors src/lib/tools/registry.ts) ──────────────────

interface ToolDef {
  name: string;
  desc: string;
  integration: string;
  icon: React.ElementType;
  auth: boolean;
  category: "commerce" | "fulfillment" | "identity" | "builtin" | "memory";
}

const TOOLS: ToolDef[] = [
  { name: "order_lookup",          desc: "Look up order status, items, and delivery info",  integration: "Commerce",     icon: ShoppingBag, auth: false, category: "commerce" },
  { name: "process_refund",        desc: "Issue a refund — requires supervisor approval",   integration: "Payments",     icon: CreditCard,  auth: true,  category: "commerce" },
  { name: "check_return_eligibility", desc: "Verify if an order is within the return window", integration: "Commerce",  icon: Package,     auth: false, category: "commerce" },
  { name: "process_replacement",   desc: "Ship replacement for defective or wrong item",    integration: "Fulfillment",  icon: Truck,       auth: true,  category: "fulfillment" },
  { name: "generate_label",        desc: "Generate a prepaid return shipping label",         integration: "Shipping",    icon: Tag,         auth: false, category: "fulfillment" },
  { name: "verify_identity",       desc: "KYC check using SSN last 4 + date of birth",      integration: "Identity",     icon: Shield,      auth: true,  category: "identity" },
  { name: "apply_promo_code",      desc: "Apply a promo code to an order or account",       integration: "Commerce",     icon: Tag,         auth: false, category: "commerce" },
  { name: "search_knowledge",      desc: "Semantic search across your knowledge base",      integration: "Built-in",    icon: BookOpen,    auth: false, category: "builtin" },
  { name: "escalate_to_human",     desc: "Warm transfer to a live agent with full context", integration: "Live Routing", icon: Users,       auth: false, category: "builtin" },
  { name: "set_variable",          desc: "Remember a value across conversation turns",      integration: "Memory",      icon: Brain,       auth: false, category: "memory" },
  { name: "get_variable",          desc: "Retrieve a previously stored variable",           integration: "Memory",      icon: Brain,       auth: false, category: "memory" },
  { name: "request_approval",      desc: "Pause and request supervisor approval",           integration: "Built-in",    icon: AlertTriangle, auth: false, category: "builtin" },
];

const CATEGORY_COLORS: Record<string, string> = {
  commerce:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
  fulfillment: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  identity:    "text-red-400 bg-red-500/10 border-red-500/20",
  builtin:     "text-[#c4a574] bg-[#c4a574]/10 border-[#c4a574]/20",
  memory:      "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const MODEL_TIERS = [
  { id: "small",     label: "Fast",      desc: "Low latency, simple tasks" },
  { id: "reasoning", label: "Balanced",  desc: "Default — good judgment, multi-step" },
  { id: "large",     label: "Powerful",  desc: "Complex cases, highest quality" },
];

// ─── Small helpers ────────────────────────────────────────────────────────

function TagInput({ values, onChange, placeholder }: {
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
    <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10 min-h-[38px]">
      {values.map((v, i) => (
        <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 text-foreground">
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
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{children}</p>;
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [form, setForm] = useState<Partial<Playbook>>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [rightTab, setRightTab] = useState<"test" | "versions">("test");
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [versions, setVersions] = useState<PlaybookVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [promptPreview, setPromptPreview] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playbooks");
      if (res.ok) setPlaybooks((await res.json()).playbooks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [testMessages]);

  function selectPlaybook(pb: Playbook) {
    setSelected(pb);
    setForm({ ...pb });
    setTestMessages([]);
    setVersions([]);
  }

  function setF<K extends keyof Playbook>(k: K, v: Playbook[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = (await res.json()).playbook;
        setSelected(updated);
        setPlaybooks(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          status: "draft",
          persona: "You are a helpful AI customer service agent.",
          instructions: ["Greet the customer warmly and ask what they need help with."],
          topics: [],
          policies: [],
          actions: ["search_knowledge", "escalate_to_human"],
          escalation_triggers: ["Customer is upset or angry", "Issue cannot be resolved with available tools"],
          model_tier: "reasoning",
        }),
      });
      if (res.ok) {
        const pb = (await res.json()).playbook;
        setPlaybooks(prev => [pb, ...prev]);
        selectPlaybook(pb);
        setCreating(false);
        setNewName("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!selected) return;
    const res = await fetch(`/api/playbooks/${selected.id}/activate`, { method: "POST" });
    if (res.ok) {
      await load();
      const updated = playbooks.find(p => p.id === selected.id);
      if (updated) setSelected({ ...updated, status: "active" });
    }
  }

  async function handleDelete() {
    if (!selected || !confirm("Delete this playbook?")) return;
    await fetch(`/api/playbooks/${selected.id}`, { method: "DELETE" }).catch(() => {});
    setPlaybooks(prev => prev.filter(p => p.id !== selected.id));
    setSelected(null);
    setForm({});
  }

  async function handleTest() {
    if (!selected || !testInput.trim()) return;
    const userMsg: TestMessage = { role: "user", content: testInput.trim() };
    const history = [...testMessages, userMsg];
    setTestMessages(history);
    setTestInput("");
    setTesting(true);
    try {
      // Save current form first so test uses latest instructions
      await fetch(`/api/playbooks/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).catch(() => {});

      const res = await fetch(`/api/playbooks/${selected.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestMessages(prev => [...prev, {
          role: "assistant",
          content: data.response ?? "(no response)",
          tool_calls: data.tool_calls ?? [],
          thinking: data.thinking_steps ?? [],
        }]);
      } else {
        setTestMessages(prev => [...prev, {
          role: "assistant",
          content: "Test error — check the server logs.",
        }]);
      }
    } finally {
      setTesting(false);
    }
  }

  async function loadVersions() {
    if (!selected) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}/versions`);
      if (res.ok) setVersions((await res.json()).versions ?? []);
    } finally {
      setLoadingVersions(false);
    }
  }

  function toggleAction(toolName: string) {
    const curr = (form.actions ?? []);
    setF("actions", curr.includes(toolName) ? curr.filter(a => a !== toolName) : [...curr, toolName]);
  }

  function addInstruction() {
    setF("instructions", [...(form.instructions ?? []), ""]);
  }

  function updateInstruction(i: number, val: string) {
    const arr = [...(form.instructions ?? [])];
    arr[i] = val;
    setF("instructions", arr);
  }

  function removeInstruction(i: number) {
    setF("instructions", (form.instructions ?? []).filter((_, j) => j !== i));
  }

  function moveInstruction(i: number, dir: -1 | 1) {
    const arr = [...(form.instructions ?? [])];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setF("instructions", arr);
  }

  function addPolicy() {
    setF("policies", [...(form.policies ?? []), { text: "", severity: "soft" }] as PlaybookPolicy[]);
  }

  function updatePolicy(i: number, field: keyof PlaybookPolicy, val: string) {
    const arr = [...(form.policies ?? [])] as PlaybookPolicy[];
    arr[i] = { ...arr[i], [field]: val } as PlaybookPolicy;
    setF("policies", arr);
  }

  function removePolicy(i: number) {
    setF("policies", (form.policies ?? []).filter((_, j) => j !== i) as PlaybookPolicy[]);
  }

  const filtered = filter === "all" ? playbooks : playbooks.filter(p => p.status === filter);
  const isDirty = JSON.stringify(form) !== JSON.stringify(selected);

  // Build system prompt preview
  function buildPreview(): string {
    const parts: string[] = [];
    if (form.persona) parts.push(form.persona, "");
    if (form.description) { parts.push("## What you handle", form.description, ""); }
    if ((form.instructions ?? []).length > 0) {
      parts.push("## Instructions", "Follow these steps in order:");
      (form.instructions ?? []).forEach((ins, i) => parts.push(`${i + 1}. ${ins}`));
      parts.push("");
    }
    if ((form.policies ?? []).length > 0) {
      parts.push("## Policies — you MUST follow these");
      (form.policies as PlaybookPolicy[] ?? []).forEach(p => parts.push(`${p.severity === "hard" ? "❌" : "⚠️"} ${p.text}`));
      parts.push("");
    }
    if ((form.escalation_triggers ?? []).length > 0) {
      parts.push("## When to escalate to a human");
      (form.escalation_triggers ?? []).forEach(t => parts.push(`- ${t}`));
    }
    return parts.join("\n");
  }

  return (
    <div className="flex h-screen overflow-hidden pt-16">
      {/* ── Sidebar: playbook list ── */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card/50">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <ScrollText className="w-4 h-4 text-[#c4a574]" />
            <span className="text-sm font-semibold">Playbooks</span>
          </div>
          {creating ? (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="Playbook name…"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none text-foreground"
                autoFocus
              />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={handleCreate} disabled={saving || !newName.trim()} className="flex-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] h-7 text-xs">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setNewName(""); }} className="h-7 text-xs">×</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => setCreating(true)} className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 h-7 text-xs">
              <Plus className="w-3 h-3" /> New Playbook
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border px-2 py-1.5 gap-0.5">
          {(["all", "active", "draft", "archived"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors capitalize ${
                filter === f ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No playbooks</p>
          ) : filtered.map(pb => (
            <button
              key={pb.id}
              onClick={() => selectPlaybook(pb)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selected?.id === pb.id ? "bg-[#c4a574]/10 border border-[#c4a574]/30" : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {pb.status === "active" && <Star className="w-2.5 h-2.5 text-[#c4a574]" />}
                <span className="text-xs font-medium truncate">{pb.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1 py-0.5 rounded ${
                  pb.status === "active" ? "bg-green-500/10 text-green-400" :
                  pb.status === "archived" ? "bg-white/5 text-muted-foreground/50" :
                  "bg-yellow-500/10 text-yellow-400"
                }`}>{pb.status}</span>
                <span className="text-[9px] text-muted-foreground/60">{pb.actions?.length ?? 0} tools</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Editor ── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 min-w-0 mr-4">
                <input
                  value={form.name ?? ""}
                  onChange={e => setF("name", e.target.value)}
                  className="text-xl font-semibold bg-transparent outline-none text-foreground w-full"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selected.status === "active" ? "bg-green-500/10 text-green-400" :
                    selected.status === "archived" ? "bg-white/5 text-muted-foreground" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>{selected.status}</span>
                  {form.model_tier && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Cpu className="w-2.5 h-2.5" />
                      {MODEL_TIERS.find(m => m.id === form.model_tier)?.label ?? form.model_tier}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.status !== "active" && (
                  <Button size="sm" onClick={handleActivate} className="bg-green-600 hover:bg-green-700 gap-1 h-7 text-xs">
                    <Star className="w-3 h-3" /> Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className={`gap-1 h-7 text-xs ${isDirty ? "bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" : "bg-white/5 text-muted-foreground"}`}
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Save
                </Button>
                <button onClick={handleDelete} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Identity */}
            <Section title="Identity">
              <div className="space-y-3">
                <div>
                  <SectionLabel>Description</SectionLabel>
                  <textarea
                    value={form.description ?? ""}
                    onChange={e => setF("description", e.target.value)}
                    placeholder="What does this playbook handle? e.g. Order returns, refunds, and shipping issues for e-commerce customers."
                    rows={2}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>
                <div>
                  <SectionLabel>Agent Persona</SectionLabel>
                  <textarea
                    value={form.persona ?? ""}
                    onChange={e => setF("persona", e.target.value)}
                    placeholder="You are Alex, a friendly and empathetic customer service agent for Acme Corp. You have deep knowledge of our return and refund policies and are authorized to process refunds up to $200 without manager approval."
                    rows={3}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none font-normal"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">This becomes the LLM&apos;s system identity. Write in second person.</p>
                </div>
                <div>
                  <SectionLabel>Topics (used for intent routing)</SectionLabel>
                  <TagInput
                    values={form.topics ?? []}
                    onChange={v => setF("topics", v)}
                    placeholder="returns, refunds, shipping — press Enter"
                  />
                </div>
                <div>
                  <SectionLabel>Model Tier</SectionLabel>
                  <div className="flex gap-2">
                    {MODEL_TIERS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setF("model_tier", m.id)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          form.model_tier === m.id
                            ? "border-[#c4a574]/40 bg-[#c4a574]/10 text-[#c4a574]"
                            : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                        }`}
                      >
                        <p className="font-medium">{m.label}</p>
                        <p className="text-[10px] opacity-70 mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Instructions */}
            <Section title="Instructions" subtitle="Natural language steps the agent follows in order. Reference tools by name.">
              <div className="space-y-2">
                {(form.instructions ?? []).map((ins, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground/60 mt-2 w-4 text-right shrink-0">{i + 1}</span>
                    <textarea
                      value={ins}
                      onChange={e => updateInstruction(i, e.target.value)}
                      placeholder={`Step ${i + 1}: what should the agent do here?`}
                      rows={2}
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                    />
                    <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                      <button onClick={() => moveInstruction(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white/5 text-muted-foreground disabled:opacity-30">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveInstruction(i, 1)} disabled={i === (form.instructions ?? []).length - 1} className="p-1 rounded hover:bg-white/5 text-muted-foreground disabled:opacity-30">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeInstruction(i)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addInstruction}
                  className="w-full py-2 border border-dashed border-white/15 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              </div>
            </Section>

            {/* Toolkit / Actions */}
            <Section title="Toolkit" subtitle="Toggle the tools this playbook's agent can call. The LLM decides when to invoke them based on your instructions.">
              <div className="grid grid-cols-2 gap-2">
                {TOOLS.map(tool => {
                  const enabled = (form.actions ?? []).includes(tool.name);
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.name}
                      onClick={() => toggleAction(tool.name)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        enabled
                          ? `${CATEGORY_COLORS[tool.category]} border-opacity-100`
                          : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${enabled ? "" : "text-muted-foreground"}`} />
                          <code className="text-[10px] font-mono font-medium">{tool.name}</code>
                        </div>
                        <div className="flex items-center gap-1">
                          {tool.auth && (
                            <span title="Requires approval">
                              <Lock className="w-2.5 h-2.5 text-muted-foreground/60" />
                            </span>
                          )}
                          {enabled && <Check className="w-3 h-3 text-current" />}
                        </div>
                      </div>
                      <p className="text-[10px] opacity-80 leading-relaxed">{tool.desc}</p>
                      <span className="text-[9px] opacity-50 mt-1 block">{tool.integration}</span>
                    </button>
                  );
                })}
              </div>
              {(form.actions ?? []).length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  <Lock className="w-2.5 h-2.5 inline mr-1" />
                  Tools marked with a lock require supervisor approval before execution.
                </p>
              )}
            </Section>

            {/* Policies */}
            <Section title="Policies" subtitle="Hard rules (agent stops immediately) and soft rules (agent flags and continues).">
              <div className="space-y-2">
                {(form.policies as PlaybookPolicy[] ?? []).map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <select
                      value={p.severity}
                      onChange={e => updatePolicy(i, "severity", e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-2 outline-none shrink-0 mt-0.5 bg-transparent ${
                        p.severity === "hard"
                          ? "border-red-500/30 text-red-400 bg-red-500/10"
                          : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                      }`}
                    >
                      <option value="hard">Hard</option>
                      <option value="soft">Soft</option>
                    </select>
                    <input
                      value={p.text}
                      onChange={e => updatePolicy(i, "text", e.target.value)}
                      placeholder="e.g. Never offer refunds over $500 without manager approval"
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                    <button onClick={() => removePolicy(i)} className="p-2 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addPolicy}
                  className="w-full py-2 border border-dashed border-white/15 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> Add Policy
                </button>
              </div>
            </Section>

            {/* Escalation */}
            <Section title="Escalation Triggers" subtitle="Natural language descriptions of when to hand off to a human agent.">
              <TagInput
                values={form.escalation_triggers ?? []}
                onChange={v => setF("escalation_triggers", v)}
                placeholder="e.g. Customer is threatening legal action — press Enter"
              />
            </Section>

            {/* End message */}
            <Section title="Closing Message (optional)" subtitle="Sent when the playbook resolves the issue.">
              <textarea
                value={form.end_message ?? ""}
                onChange={e => setF("end_message", e.target.value)}
                placeholder="Is there anything else I can help you with today?"
                rows={2}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
              />
            </Section>

            {/* System prompt preview */}
            <div className="mt-4">
              <button
                onClick={() => setPromptPreview(!promptPreview)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Code className="w-3.5 h-3.5" />
                {promptPreview ? "Hide" : "Preview"} system prompt
                {promptPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {promptPreview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 p-4 bg-[#050505] rounded-xl text-[10px] font-mono text-green-300/70 overflow-x-auto leading-relaxed border border-white/5 max-h-80 overflow-y-auto">
                      {buildPreview() || "(fill in Persona and Instructions to preview)"}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <ScrollText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Select a playbook to edit</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Or create a new one</p>
          </div>
        </div>
      )}

      {/* ── Right panel: Test + Versions ── */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-border flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-border p-1.5 gap-1">
            <button
              onClick={() => setRightTab("test")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                rightTab === "test" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Terminal className="w-3 h-3" /> Test Console
            </button>
            <button
              onClick={() => { setRightTab("versions"); loadVersions(); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                rightTab === "versions" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-3 h-3" /> History
            </button>
          </div>

          {rightTab === "test" && (
            <>
              {/* Test chat */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {testMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Test your playbook live</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Changes are saved before each test run</p>
                  </div>
                )}
                {testMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] space-y-1.5`}>
                      <div className={`text-xs px-3 py-2 rounded-xl ${
                        msg.role === "user"
                          ? "bg-[#c4a574]/20 text-foreground rounded-tr-sm"
                          : "bg-white/5 text-foreground rounded-tl-sm"
                      }`}>
                        {msg.content}
                      </div>
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="space-y-1">
                          {msg.tool_calls.map((tc, j) => (
                            <div key={j} className="text-[10px] bg-blue-500/5 border border-blue-500/15 rounded-lg px-2.5 py-1.5 font-mono">
                              <span className="text-blue-400">{tc.tool}</span>
                              {tc.result !== undefined && (
                                <span className="text-muted-foreground ml-2">→ {String(JSON.stringify(tc.result)).slice(0, 60)}{String(JSON.stringify(tc.result)).length > 60 ? "…" : ""}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {showThinking && msg.thinking && msg.thinking.length > 0 && (
                        <div className="text-[10px] text-muted-foreground/60 italic px-2">
                          {msg.thinking[0]?.slice(0, 100)}{(msg.thinking[0]?.length ?? 0) > 100 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {testing && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-xl rounded-tl-sm px-3 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Controls */}
              <div className="p-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showThinking ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    {showThinking ? "Hide" : "Show"} thinking
                  </button>
                  {testMessages.length > 0 && (
                    <button
                      onClick={() => setTestMessages([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Reset
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTest(); } }}
                    placeholder="Type a message… (Enter to send)"
                    rows={2}
                    disabled={testing}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !testInput.trim()}
                    className="p-2 rounded-xl bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] disabled:opacity-40 self-end"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {rightTab === "versions" && (
            <div className="flex-1 overflow-y-auto p-3">
              {loadingVersions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No versions yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Versions are snapshoted when you activate a playbook</p>
                  <Button size="sm" onClick={loadVersions} className="mt-3 h-7 text-xs gap-1" variant="outline">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, i) => (
                    <div key={v.id} className={`p-3 rounded-xl border ${i === 0 ? "border-[#c4a574]/30 bg-[#c4a574]/5" : "border-border bg-white/3"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">v{v.version}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/20 text-[#c4a574]">Latest</span>}
                      </div>
                      {v.change_summary && <p className="text-[10px] text-muted-foreground">{v.change_summary}</p>}
                      <p className="text-[9px] text-muted-foreground/60 mt-1">
                        {new Date(v.created_at).toLocaleString()}
                        {v.created_by && ` · by ${v.created_by}`}
                      </p>
                      <button
                        onClick={() => { setForm({ ...v.snapshot }); }}
                        className="mt-2 text-[10px] text-[#c4a574] hover:underline"
                      >
                        Restore this version
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
