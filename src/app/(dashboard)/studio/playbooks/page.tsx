"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText, Plus, CheckCircle, Loader2, Sparkles,
  Shield, Zap, X, Star, Send, ChevronDown, ChevronUp,
  Code, Clock, RefreshCw, Trash2, ShoppingBag, CreditCard,
  Package, Truck, Tag, BookOpen, Users, Brain, Lock,
  Terminal, Eye, EyeOff, ArrowUp, ArrowDown,
  AlertTriangle, Check, Cpu, Ban, MessageSquare,
  Activity, RotateCcw, Copy, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────

interface PlaybookPolicy {
  text: string;
  severity: "hard" | "soft";
}

interface PlaybookGuardrails {
  content_safety: "strict" | "moderate" | "off";
  pii_protection: boolean;
  restricted_topics: string[];
  competitor_deflection: boolean;
  off_topic_message: string;
  language_safety: boolean;
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
  guardrails?: PlaybookGuardrails;
  max_turns?: number;
  handoff_on_repeat?: boolean;
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
  turn?: number;
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
  { name: "order_lookup",             desc: "Look up order status, items, and delivery info",   integration: "Commerce",     icon: ShoppingBag,    auth: false, category: "commerce" },
  { name: "process_refund",           desc: "Issue a refund — requires supervisor approval",    integration: "Payments",     icon: CreditCard,     auth: true,  category: "commerce" },
  { name: "check_return_eligibility", desc: "Verify if an order is within the return window",   integration: "Commerce",     icon: Package,        auth: false, category: "commerce" },
  { name: "process_replacement",      desc: "Ship replacement for defective or wrong item",     integration: "Fulfillment",  icon: Truck,          auth: true,  category: "fulfillment" },
  { name: "generate_label",           desc: "Generate a prepaid return shipping label",          integration: "Shipping",    icon: Tag,            auth: false, category: "fulfillment" },
  { name: "verify_identity",          desc: "KYC check using SSN last 4 + date of birth",       integration: "Identity",     icon: Shield,         auth: true,  category: "identity" },
  { name: "apply_promo_code",         desc: "Apply a promo code to an order or account",        integration: "Commerce",     icon: Tag,            auth: false, category: "commerce" },
  { name: "search_knowledge",         desc: "Semantic search across your knowledge base",       integration: "Built-in",    icon: BookOpen,       auth: false, category: "builtin" },
  { name: "escalate_to_human",        desc: "Warm transfer to a live agent with full context",  integration: "Live Routing", icon: Users,          auth: false, category: "builtin" },
  { name: "set_variable",             desc: "Persist a value across conversation turns",        integration: "Memory",      icon: Brain,          auth: false, category: "memory" },
  { name: "get_variable",             desc: "Retrieve a value stored in a previous turn",       integration: "Memory",      icon: Brain,          auth: false, category: "memory" },
  { name: "request_approval",         desc: "Pause and request supervisor approval before continuing", integration: "Built-in", icon: AlertTriangle, auth: false, category: "builtin" },
];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  commerce:    { label: "Commerce",    color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  fulfillment: { label: "Fulfillment", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  identity:    { label: "Identity",    color: "text-red-400 bg-red-500/10 border-red-500/20" },
  builtin:     { label: "Built-in",    color: "text-[#c4a574] bg-[#c4a574]/10 border-[#c4a574]/20" },
  memory:      { label: "Memory",      color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
};

const TOOL_CATEGORIES = ["commerce", "fulfillment", "identity", "builtin", "memory"] as const;

const MODEL_TIERS = [
  { id: "small",     label: "Fast",     desc: "Low latency, simple tasks",               badge: "~0.5s" },
  { id: "reasoning", label: "Balanced", desc: "Good judgment, multi-step reasoning",     badge: "~1.5s" },
  { id: "large",     label: "Powerful", desc: "Complex cases, highest quality output",   badge: "~3s"   },
];

const DEFAULT_GUARDRAILS: PlaybookGuardrails = {
  content_safety: "moderate",
  pii_protection: true,
  restricted_topics: [],
  competitor_deflection: false,
  off_topic_message: "",
  language_safety: true,
};

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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-[#c4a574]" : "bg-white/20"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{children}</p>
      {hint && (
        <span title={hint} className="text-muted-foreground/40 hover:text-muted-foreground cursor-help">
          <Info className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

function Section({ title, subtitle, badge, children }: {
  title: string;
  subtitle?: string;
  badge?: string | number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 pb-8 border-b border-white/5 last:border-0">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {badge !== undefined && badge !== 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c4a574]/20 text-[#c4a574] font-medium">{badge}</span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Editor Tab ───────────────────────────────────────────────────────────

type EditorTab = "identity" | "instructions" | "tools" | "policies" | "guardrails" | "conversation";

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ElementType }[] = [
  { id: "identity",     label: "Identity",     icon: Sparkles },
  { id: "instructions", label: "Instructions", icon: ScrollText },
  { id: "tools",        label: "Tools",        icon: Zap },
  { id: "policies",     label: "Policies",     icon: Shield },
  { id: "guardrails",   label: "Guardrails",   icon: Ban },
  { id: "conversation", label: "Conversation", icon: MessageSquare },
];

// ─── Main Component ───────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [form, setForm] = useState<Partial<Playbook>>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("identity");

  const [rightTab, setRightTab] = useState<"test" | "versions">("test");
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showVars, setShowVars] = useState(false);
  // Accumulated variables across test turns — mirrors what production persists to DB
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<PlaybookVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [promptPreview, setPromptPreview] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [toolCategory, setToolCategory] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const turnCount = testMessages.filter(m => m.role === "user").length;

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
    setForm({ ...pb, guardrails: pb.guardrails ?? { ...DEFAULT_GUARDRAILS } });
    setTestMessages([]);
    setTestVariables({});
    setVersions([]);
    setEditorTab("identity");
  }

  function setF<K extends keyof Playbook>(k: K, v: Playbook[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function setGuardrail<K extends keyof PlaybookGuardrails>(k: K, v: PlaybookGuardrails[K]) {
    setForm(f => ({
      ...f,
      guardrails: { ...(f.guardrails ?? DEFAULT_GUARDRAILS), [k]: v },
    }));
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
          instructions: ["Greet the customer warmly and ask how you can help."],
          topics: [],
          policies: [],
          actions: ["search_knowledge", "escalate_to_human"],
          escalation_triggers: ["Customer is upset or distressed", "Issue cannot be resolved with available tools"],
          model_tier: "reasoning",
          guardrails: { ...DEFAULT_GUARDRAILS },
          max_turns: 20,
          handoff_on_repeat: true,
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
    await handleSave();
    const res = await fetch(`/api/playbooks/${selected.id}/activate`, { method: "POST" });
    if (res.ok) {
      await load();
      setSelected(prev => prev ? { ...prev, status: "active" } : null);
    }
  }

  async function handleDelete() {
    if (!selected || !confirm("Delete this playbook? This cannot be undone.")) return;
    await fetch(`/api/playbooks/${selected.id}`, { method: "DELETE" }).catch(() => {});
    setPlaybooks(prev => prev.filter(p => p.id !== selected.id));
    setSelected(null);
    setForm({});
  }

  async function handleTest() {
    if (!selected || !testInput.trim()) return;
    const userMsg: TestMessage = { role: "user", content: testInput.trim(), turn: turnCount + 1 };
    const history = [...testMessages, userMsg];
    setTestMessages(history);
    setTestInput("");
    setTesting(true);
    try {
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
          // Pass accumulated variables so the LLM has cross-turn memory
          variables: testVariables,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Merge returned variables into accumulated state for the next turn
        if (data.variables && Object.keys(data.variables).length > 0) {
          setTestVariables(prev => ({ ...prev, ...data.variables }));
        }
        setTestMessages(prev => [...prev, {
          role: "assistant",
          content: data.response ?? "(no response)",
          tool_calls: data.tool_calls ?? [],
          thinking: data.thinking_steps ?? [],
          turn: turnCount + 1,
        }]);
      } else {
        setTestMessages(prev => [...prev, { role: "assistant", content: "Test error — check server logs.", turn: turnCount + 1 }]);
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

  function addInstruction() { setF("instructions", [...(form.instructions ?? []), ""]); }
  function updateInstruction(i: number, val: string) {
    const arr = [...(form.instructions ?? [])]; arr[i] = val; setF("instructions", arr);
  }
  function removeInstruction(i: number) { setF("instructions", (form.instructions ?? []).filter((_, j) => j !== i)); }
  function moveInstruction(i: number, dir: -1 | 1) {
    const arr = [...(form.instructions ?? [])]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setF("instructions", arr);
  }

  function addPolicy() { setF("policies", [...(form.policies ?? []), { text: "", severity: "soft" }] as PlaybookPolicy[]); }
  function updatePolicy(i: number, field: keyof PlaybookPolicy, val: string) {
    const arr = [...(form.policies ?? [])] as PlaybookPolicy[];
    arr[i] = { ...arr[i], [field]: val } as PlaybookPolicy;
    setF("policies", arr);
  }
  function removePolicy(i: number) { setF("policies", (form.policies ?? []).filter((_, j) => j !== i) as PlaybookPolicy[]); }

  function copyPrompt() {
    navigator.clipboard.writeText(buildPreview()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = filter === "all" ? playbooks : playbooks.filter(p => p.status === filter);
  const isDirty = JSON.stringify(form) !== JSON.stringify(selected);
  const visibleTools = toolCategory === "all" ? TOOLS : TOOLS.filter(t => t.category === toolCategory);

  function buildPreview(): string {
    const parts: string[] = [];
    if (form.persona) parts.push(form.persona, "");
    if (form.description) parts.push("## What you handle", form.description, "");
    if ((form.instructions ?? []).length > 0) {
      parts.push("## Instructions", "Follow these steps in order:");
      (form.instructions ?? []).forEach((ins, i) => parts.push(`${i + 1}. ${ins}`));
      parts.push("");
    }
    if ((form.policies as PlaybookPolicy[] ?? []).length > 0) {
      parts.push("## Policies — you MUST follow these");
      (form.policies as PlaybookPolicy[] ?? []).forEach(p => parts.push(`${p.severity === "hard" ? "❌" : "⚠️"} ${p.text}`));
      parts.push("");
    }
    const gr = form.guardrails ?? DEFAULT_GUARDRAILS;
    if (gr.restricted_topics?.length > 0) {
      parts.push("## Restricted Topics — never discuss these");
      gr.restricted_topics.forEach(t => parts.push(`- ${t}`));
      parts.push("");
    }
    if ((form.escalation_triggers ?? []).length > 0) {
      parts.push("## When to escalate to a human");
      (form.escalation_triggers ?? []).forEach(t => parts.push(`- ${t}`));
    }
    return parts.join("\n");
  }

  const gr = form.guardrails ?? DEFAULT_GUARDRAILS;

  return (
    <div className="flex h-screen overflow-hidden pt-16">

      {/* ── Sidebar: playbook list ── */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-[#0d0d0d]">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <ScrollText className="w-4 h-4 text-[#c4a574]" />
            <span className="text-sm font-semibold">Playbooks</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{playbooks.filter(p => p.status === "active").length} active</span>
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
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setNewName(""); }} className="h-7 text-xs border-white/10">×</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => setCreating(true)} className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 h-7 text-xs">
              <Plus className="w-3 h-3" /> New Playbook
            </Button>
          )}
        </div>

        <div className="flex border-b border-border px-2 py-1.5 gap-0.5">
          {(["all", "active", "draft", "archived"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors capitalize ${filter === f ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No playbooks</p>
          ) : filtered.map(pb => (
            <button
              key={pb.id}
              onClick={() => selectPlaybook(pb)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selected?.id === pb.id ? "bg-[#c4a574]/10 border border-[#c4a574]/20" : "hover:bg-white/5 border border-transparent"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {pb.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
                <span className="text-xs font-medium truncate">{pb.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${pb.status === "active" ? "bg-green-500/10 text-green-400" : pb.status === "archived" ? "bg-white/5 text-muted-foreground/50" : "bg-yellow-500/10 text-yellow-400"}`}>
                  {pb.status}
                </span>
                <span className="text-[9px] text-muted-foreground/50">{pb.actions?.length ?? 0} tools · {pb.instructions?.length ?? 0} steps</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Center: Editor ── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-border px-6 py-3 flex items-center gap-3 bg-[#0a0a0a] shrink-0">
            <div className="flex-1 min-w-0">
              <input
                value={form.name ?? ""}
                onChange={e => setF("name", e.target.value)}
                className="text-base font-semibold bg-transparent outline-none text-foreground w-full"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selected.status === "active" ? "bg-green-500/10 text-green-400" : selected.status === "archived" ? "bg-white/5 text-muted-foreground" : "bg-yellow-500/10 text-yellow-400"}`}>
                  {selected.status}
                </span>
                {form.model_tier && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" />
                    {MODEL_TIERS.find(m => m.id === form.model_tier)?.label ?? form.model_tier}
                  </span>
                )}
                {isDirty && <span className="text-[10px] text-yellow-400/70">unsaved changes</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selected.status !== "active" && (
                <Button size="sm" onClick={handleActivate} className="bg-green-600 hover:bg-green-700 gap-1 h-7 text-xs">
                  <Star className="w-3 h-3" /> Activate
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || !isDirty} className={`gap-1 h-7 text-xs ${isDirty ? "bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" : "bg-white/5 text-muted-foreground"}`}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Save
              </Button>
              <button onClick={handleDelete} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editor tabs */}
          <div className="flex border-b border-border bg-[#0a0a0a] px-6 gap-0.5 shrink-0 overflow-x-auto">
            {EDITOR_TABS.map(tab => {
              const Icon = tab.icon;
              let badge: number | undefined;
              if (tab.id === "instructions") badge = (form.instructions ?? []).length;
              if (tab.id === "tools") badge = (form.actions ?? []).length;
              if (tab.id === "policies") badge = (form.policies ?? []).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setEditorTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${editorTab === tab.id ? "border-[#c4a574] text-[#c4a574]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  {badge !== undefined && badge > 0 && (
                    <span className={`text-[9px] px-1 py-0.5 rounded-full ${editorTab === tab.id ? "bg-[#c4a574]/20 text-[#c4a574]" : "bg-white/10 text-muted-foreground"}`}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-6">

              {/* ── Identity tab ── */}
              {editorTab === "identity" && (
                <AnimatePresence mode="wait">
                  <motion.div key="identity" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section title="Description" subtitle="What situations does this playbook handle? Used for intent routing and reporting.">
                      <textarea
                        value={form.description ?? ""}
                        onChange={e => setF("description", e.target.value)}
                        placeholder="e.g. Handles order returns, refunds, and shipping issues for e-commerce customers."
                        rows={2}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                      />
                    </Section>

                    <Section title="Agent Persona" subtitle="The LLM's identity. Write in second person — this becomes the first paragraph of the system prompt.">
                      <textarea
                        value={form.persona ?? ""}
                        onChange={e => setF("persona", e.target.value)}
                        placeholder="You are Alex, a friendly and empathetic customer service agent for Acme Corp. You have deep expertise in our return and refund policies and are authorized to process refunds up to $200 without manager approval. You are warm, efficient, and always aim to resolve issues on the first contact."
                        rows={4}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none font-normal focus:border-white/20"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">Include: name, company, expertise, authorization limits, tone.</p>
                    </Section>

                    <Section title="Topics" subtitle="Keywords used by the intent router to dispatch conversations to this playbook.">
                      <TagInput values={form.topics ?? []} onChange={v => setF("topics", v)} placeholder="returns, refunds, shipping — press Enter" />
                    </Section>

                    <Section title="Model Tier" subtitle="Higher tiers are more capable but slower. Use Fast for simple lookups, Powerful for complex multi-step reasoning.">
                      <div className="grid grid-cols-3 gap-2">
                        {MODEL_TIERS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setF("model_tier", m.id)}
                            className={`text-left px-3 py-3 rounded-xl border text-xs transition-all ${form.model_tier === m.id ? "border-[#c4a574]/50 bg-[#c4a574]/10" : "border-white/10 bg-white/3 hover:border-white/20"}`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <p className={`font-semibold ${form.model_tier === m.id ? "text-[#c4a574]" : "text-foreground"}`}>{m.label}</p>
                              <span className="text-[10px] text-muted-foreground">{m.badge}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{m.desc}</p>
                          </button>
                        ))}
                      </div>
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Instructions tab ── */}
              {editorTab === "instructions" && (
                <AnimatePresence mode="wait">
                  <motion.div key="instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section
                      title="Instructions"
                      badge={(form.instructions ?? []).length}
                      subtitle="Natural language steps the agent follows in order. Be specific — reference tools by name (e.g. 'call order_lookup'), describe decision points, and include what to say."
                    >
                      <div className="space-y-2">
                        {(form.instructions ?? []).map((ins, i) => (
                          <motion.div key={i} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
                            <span className="text-xs text-muted-foreground/50 mt-3 w-5 text-right shrink-0 font-mono">{i + 1}</span>
                            <textarea
                              value={ins}
                              onChange={e => updateInstruction(i, e.target.value)}
                              placeholder={`Step ${i + 1}: describe what the agent should do…`}
                              rows={2}
                              className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                            />
                            <div className="flex flex-col gap-0.5 shrink-0 mt-2">
                              <button onClick={() => moveInstruction(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white/5 text-muted-foreground disabled:opacity-20 transition-colors">
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button onClick={() => moveInstruction(i, 1)} disabled={i === (form.instructions ?? []).length - 1} className="p-1 rounded hover:bg-white/5 text-muted-foreground disabled:opacity-20 transition-colors">
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button onClick={() => removeInstruction(i)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                        <button
                          onClick={addInstruction}
                          className="w-full py-2.5 border border-dashed border-white/15 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3 h-3" /> Add Step
                        </button>
                      </div>

                      {(form.instructions ?? []).length === 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-[#c4a574]/5 border border-[#c4a574]/15">
                          <p className="text-[10px] text-[#c4a574]/80 font-medium mb-1">Example steps</p>
                          <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Greet the customer and ask for their order number</li>
                            <li>Call order_lookup to retrieve the order details</li>
                            <li>If the order is eligible, call check_return_eligibility</li>
                            <li>If eligible, generate a return label with generate_label</li>
                            <li>If not eligible, explain the policy and offer alternatives</li>
                          </ol>
                        </div>
                      )}
                    </Section>

                    <Section title="Closing Message" subtitle="Optional message sent when the issue is resolved.">
                      <textarea
                        value={form.end_message ?? ""}
                        onChange={e => setF("end_message", e.target.value)}
                        placeholder="Is there anything else I can help you with today?"
                        rows={2}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                      />
                    </Section>

                    <Section title="Escalation Triggers" subtitle="Natural language descriptions of when to hand off to a human agent.">
                      <TagInput
                        values={form.escalation_triggers ?? []}
                        onChange={v => setF("escalation_triggers", v)}
                        placeholder="e.g. Customer threatens legal action — press Enter"
                      />
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Tools tab ── */}
              {editorTab === "tools" && (
                <AnimatePresence mode="wait">
                  <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section
                      title="Toolkit"
                      badge={(form.actions ?? []).length}
                      subtitle="Enable the tools this playbook can invoke. The LLM decides when to call them based on your instructions. Tools marked with a lock require supervisor approval."
                    >
                      {/* Category filter */}
                      <div className="flex gap-1.5 mb-4 flex-wrap">
                        <button onClick={() => setToolCategory("all")} className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${toolCategory === "all" ? "bg-white/10 border-white/20 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                          All ({TOOLS.length})
                        </button>
                        {TOOL_CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setToolCategory(cat)} className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors capitalize ${toolCategory === cat ? `${CATEGORY_META[cat].color}` : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                            {CATEGORY_META[cat].label} ({TOOLS.filter(t => t.category === cat).length})
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {visibleTools.map(tool => {
                          const enabled = (form.actions ?? []).includes(tool.name);
                          const Icon = tool.icon;
                          const meta = CATEGORY_META[tool.category];
                          return (
                            <button
                              key={tool.name}
                              onClick={() => toggleAction(tool.name)}
                              className={`text-left p-3 rounded-xl border transition-all ${enabled ? `${meta.color} ring-1 ring-current/20` : "border-white/8 bg-white/2 text-muted-foreground hover:border-white/15 hover:bg-white/5"}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="w-3.5 h-3.5 shrink-0" />
                                  <code className="text-[10px] font-mono font-semibold">{tool.name}</code>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  {tool.auth && <span title="Requires approval"><Lock className="w-2.5 h-2.5 opacity-50" /></span>}
                                  {enabled && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                              <p className="text-[10px] opacity-75 leading-relaxed">{tool.desc}</p>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="text-[9px] opacity-50">{tool.integration}</span>
                                {enabled && <span className="text-[9px] opacity-60">enabled</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {(form.actions ?? []).length > 0 && (
                        <div className="mt-4 p-3 rounded-xl bg-white/3 border border-white/8">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Enabled tools</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(form.actions ?? []).map(a => {
                              const t = TOOLS.find(x => x.name === a);
                              return (
                                <span key={a} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono ${t ? CATEGORY_META[t.category].color : "border-white/10 text-muted-foreground"}`}>
                                  {a}
                                  {t?.auth && <Lock className="w-2 h-2 opacity-50" />}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Policies tab ── */}
              {editorTab === "policies" && (
                <AnimatePresence mode="wait">
                  <motion.div key="policies" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section
                      title="Playbook Policies"
                      badge={(form.policies ?? []).length}
                      subtitle="Rules specific to this playbook. Hard rules cause the agent to stop immediately. Soft rules are flagged in the audit log but execution continues."
                    >
                      <div className="space-y-2">
                        {(form.policies as PlaybookPolicy[] ?? []).map((p, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <select
                              value={p.severity}
                              onChange={e => updatePolicy(i, "severity", e.target.value)}
                              className={`text-xs border rounded-lg px-2 py-2 outline-none shrink-0 bg-transparent ${p.severity === "hard" ? "border-red-500/40 text-red-400 bg-red-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"}`}
                            >
                              <option value="hard">Hard</option>
                              <option value="soft">Soft</option>
                            </select>
                            <input
                              value={p.text}
                              onChange={e => updatePolicy(i, "text", e.target.value)}
                              placeholder="e.g. Never offer refunds over $500 without manager approval"
                              className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 focus:border-white/20"
                            />
                            <button onClick={() => removePolicy(i)} className="p-2 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 shrink-0 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button onClick={addPolicy} className="w-full py-2.5 border border-dashed border-white/15 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors flex items-center justify-center gap-1.5">
                          <Plus className="w-3 h-3" /> Add Policy
                        </button>
                      </div>

                      <div className="mt-4 p-3 rounded-xl bg-white/3 border border-white/8 space-y-2">
                        <p className="text-[10px] text-muted-foreground font-medium">Policy effects</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                          <div><span className="text-red-400 font-mono">Hard</span> — agent stops immediately, responds with a block message</div>
                          <div><span className="text-yellow-400 font-mono">Soft</span> — agent flags the event but continues the conversation</div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">Global policies (set in the Policies page) apply in addition to these.</p>
                      </div>
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Guardrails tab ── */}
              {editorTab === "guardrails" && (
                <AnimatePresence mode="wait">
                  <motion.div key="guardrails" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section title="Content Safety" subtitle="Controls how aggressively the agent filters harmful or inappropriate content.">
                      <div className="grid grid-cols-3 gap-2">
                        {(["strict", "moderate", "off"] as const).map(level => (
                          <button
                            key={level}
                            onClick={() => setGuardrail("content_safety", level)}
                            className={`px-3 py-2.5 rounded-xl border text-xs transition-all ${(gr.content_safety ?? "moderate") === level
                              ? level === "off" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-[#c4a574]/40 bg-[#c4a574]/10 text-[#c4a574]"
                              : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"}`}
                          >
                            <p className="font-semibold capitalize">{level}</p>
                            <p className="text-[10px] opacity-70 mt-0.5">
                              {level === "strict" ? "Maximum filtering" : level === "moderate" ? "Balanced — default" : "No filtering"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </Section>

                    <Section title="Automatic Protections" subtitle="Toggle automatic safety mechanisms applied to every conversation.">
                      <div className="space-y-2">
                        {[
                          { key: "pii_protection" as const, label: "PII Protection", desc: "Auto-detect and mask SSNs, credit card numbers, and phone numbers in responses" },
                          { key: "competitor_deflection" as const, label: "Competitor Deflection", desc: "Automatically deflect questions about competitor products and services" },
                          { key: "language_safety" as const, label: "Language Safety", desc: "Filter profanity, slurs, and aggressively inappropriate language" },
                        ].map(item => (
                          <div key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2">
                            <div className="mr-4">
                              <p className="text-xs font-medium">{item.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <Toggle
                              on={!!gr[item.key]}
                              onToggle={() => setGuardrail(item.key, !gr[item.key] as PlaybookGuardrails[typeof item.key])}
                            />
                          </div>
                        ))}
                      </div>
                    </Section>

                    <Section title="Restricted Topics" subtitle="Topics this agent will refuse to discuss. Overrides global topic restrictions.">
                      <TagInput
                        values={gr.restricted_topics ?? []}
                        onChange={v => setGuardrail("restricted_topics", v)}
                        placeholder="e.g. politics, religion, competitor_x — press Enter"
                      />
                    </Section>

                    <Section title="Off-Topic Response" subtitle="What the agent says when a conversation veers into a restricted topic.">
                      <textarea
                        value={gr.off_topic_message ?? ""}
                        onChange={e => setGuardrail("off_topic_message", e.target.value)}
                        placeholder="I'm not able to help with that, but I'm happy to assist with any questions about your orders or account."
                        rows={2}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                      />
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Conversation tab ── */}
              {editorTab === "conversation" && (
                <AnimatePresence mode="wait">
                  <motion.div key="conversation" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Section title="Multi-Turn Behaviour" subtitle="How the agent manages long conversations and repeated interactions.">
                      <div className="space-y-4">
                        <div>
                          <SectionLabel hint="Maximum number of turns before the agent wraps up or escalates">Max Turns per Session</SectionLabel>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={5}
                              max={50}
                              step={5}
                              value={form.max_turns ?? 20}
                              onChange={e => setF("max_turns", parseInt(e.target.value))}
                              className="flex-1 accent-[#c4a574]"
                            />
                            <span className="text-sm font-mono w-8 text-center">{form.max_turns ?? 20}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">After {form.max_turns ?? 20} turns without resolution, the agent will attempt to wrap up or escalate.</p>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2">
                          <div className="mr-4">
                            <p className="text-xs font-medium">Escalate on Repeated Issues</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">If the same issue appears 3+ times in one session, hand off to a human agent</p>
                          </div>
                          <Toggle on={!!form.handoff_on_repeat} onToggle={() => setF("handoff_on_repeat", !form.handoff_on_repeat)} />
                        </div>
                      </div>
                    </Section>

                    <Section title="Memory" subtitle="Control how the agent remembers context across turns within a session.">
                      <div className="space-y-2">
                        {[
                          { label: "Variable memory", desc: "Use set_variable / get_variable tools to persist key values across turns", always: true },
                          { label: "Full conversation history", desc: "Every message in the session is included in the LLM context window", always: true },
                          { label: "Customer profile injection", desc: "Customer name, tier, and history injected at conversation start", always: true },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2">
                            <div className="mr-4">
                              <p className="text-xs font-medium">{item.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-green-400">Always on</span>
                              <Check className="w-3 h-3 text-green-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>

                    <Section title="System Prompt Preview" subtitle="The assembled prompt sent to the LLM on each turn. Read-only.">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setPromptPreview(!promptPreview)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Code className="w-3.5 h-3.5" />
                          {promptPreview ? "Collapse" : "Expand"} preview
                          {promptPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {promptPreview && (
                          <button onClick={copyPrompt} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {promptPreview && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <pre className="p-4 bg-[#050505] rounded-xl text-[10px] font-mono text-green-300/70 overflow-x-auto leading-relaxed border border-white/5 max-h-80 overflow-y-auto">
                              {buildPreview() || "(fill in Persona and Instructions above to preview)"}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Section>
                  </motion.div>
                </AnimatePresence>
              )}

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <ScrollText className="w-10 h-10 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground mb-1">No playbook selected</p>
            <p className="text-xs text-muted-foreground/60">Choose one from the sidebar or create a new one</p>
            <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/2 text-left max-w-xs mx-auto">
              <p className="text-[10px] font-medium text-muted-foreground mb-2">Playbooks provide:</p>
              <ul className="space-y-1.5 text-[10px] text-muted-foreground/70">
                <li className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 text-[#c4a574] shrink-0" />Natural language agent instructions</li>
                <li className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 text-[#c4a574] shrink-0" />Scoped tool access</li>
                <li className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 text-[#c4a574] shrink-0" />Hard + soft policy rules</li>
                <li className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 text-[#c4a574] shrink-0" />Per-playbook guardrails</li>
                <li className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 text-[#c4a574] shrink-0" />Multi-turn conversation control</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Right panel: Test Console + Version History ── */}
      {selected && (
        <div className="w-80 shrink-0 border-l border-border flex flex-col bg-[#0d0d0d]">
          <div className="flex border-b border-border p-1.5 gap-1 shrink-0">
            <button onClick={() => setRightTab("test")} className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${rightTab === "test" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Terminal className="w-3 h-3" /> Test Console
            </button>
            <button onClick={() => { setRightTab("versions"); loadVersions(); }} className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${rightTab === "versions" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Clock className="w-3 h-3" /> History
            </button>
          </div>

          {rightTab === "test" && (
            <>
              {/* Turn counter + controls */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground">Turn {turnCount}/{form.max_turns ?? 20}</span>
                  {turnCount > 0 && (
                    <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#c4a574] rounded-full transition-all" style={{ width: `${Math.min((turnCount / (form.max_turns ?? 20)) * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowThinking(!showThinking)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    {showThinking ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    {showThinking ? "Hide" : "Thinking"}
                  </button>
                  {Object.keys(testVariables).length > 0 && (
                    <button onClick={() => setShowVars(!showVars)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                      <Brain className="w-2.5 h-2.5" /> {Object.keys(testVariables).length}
                    </button>
                  )}
                  {testMessages.length > 0 && (
                    <button onClick={() => { setTestMessages([]); setTestVariables({}); }} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      <RotateCcw className="w-2.5 h-2.5" /> Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Variable memory panel — shows what's been stored across turns */}
              <AnimatePresence>
                {showVars && Object.keys(testVariables).length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-border shrink-0"
                  >
                    <div className="p-3 bg-purple-500/5">
                      <p className="text-[10px] font-medium text-purple-400 mb-2 flex items-center gap-1.5">
                        <Brain className="w-3 h-3" /> Session Memory ({Object.keys(testVariables).length} variables)
                      </p>
                      <div className="space-y-1">
                        {Object.entries(testVariables).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-purple-400/80 shrink-0">{k}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {testMessages.length === 0 && (
                  <div className="text-center py-10">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">Live conversation simulator</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1 leading-relaxed">Saves your changes before each test run. Tool calls, thinking steps, and multi-turn memory are shown.</p>
                  </div>
                )}
                {testMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[92%] space-y-1.5">
                      {msg.turn && msg.role === "user" && (
                        <p className="text-[9px] text-muted-foreground/40 text-right">Turn {msg.turn}</p>
                      )}
                      <div className={`text-xs px-3 py-2 rounded-xl leading-relaxed ${msg.role === "user" ? "bg-[#c4a574]/15 text-foreground rounded-tr-sm" : "bg-white/6 text-foreground rounded-tl-sm"}`}>
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
                        <div className="text-[10px] text-muted-foreground/50 italic px-2 border-l border-white/10">
                          {msg.thinking[0]?.slice(0, 120)}{(msg.thinking[0]?.length ?? 0) > 120 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {testing && (
                  <div className="flex justify-start">
                    <div className="bg-white/6 rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4a574] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4a574] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4a574] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTest(); } }}
                    placeholder="Type a message… (Enter to send)"
                    rows={2}
                    disabled={testing}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !testInput.trim()}
                    className="p-2.5 rounded-xl bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] disabled:opacity-40 self-end transition-colors"
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
                <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No versions yet</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Versions are snapshotted when you activate a playbook</p>
                  <Button size="sm" onClick={loadVersions} className="mt-3 h-7 text-xs gap-1" variant="outline">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((v, i) => (
                    <div key={v.id} className={`p-3 rounded-xl border ${i === 0 ? "border-[#c4a574]/30 bg-[#c4a574]/5" : "border-white/8 bg-white/2"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold font-mono">v{v.version}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c4a574]/20 text-[#c4a574]">Latest</span>}
                      </div>
                      {v.change_summary && <p className="text-[10px] text-muted-foreground">{v.change_summary}</p>}
                      <p className="text-[9px] text-muted-foreground/50 mt-1">
                        {new Date(v.created_at).toLocaleString()}{v.created_by ? ` · ${v.created_by}` : ""}
                      </p>
                      <button onClick={() => setForm({ ...v.snapshot, guardrails: v.snapshot.guardrails ?? { ...DEFAULT_GUARDRAILS } })} className="mt-2 text-[10px] text-[#c4a574] hover:underline">
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
