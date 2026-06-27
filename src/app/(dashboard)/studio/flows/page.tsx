"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow, Plus, Loader2, CheckCircle, Archive, Zap,
  Trash2, Play, Pause, Clock, MessageSquare, GitBranch,
  Code, ChevronRight, ArrowRight, AlertCircle, Users,
  Database, Search, ToggleRight, CornerDownRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface JourneyNode {
  id: string;
  type: "start" | "message" | "input" | "condition" | "action" | "api" | "intent" | "transfer" | "end";
  label?: string;
  data?: {
    text?: string;
    prompt?: string;
    variable?: string;
    condition?: string;
    action?: string;
    value?: string;
    endpoint?: string;
    params?: string[];
    department?: string;
    reason?: string;
  };
}

interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

interface Journey {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  execution_mode: "deterministic" | "llm" | "hybrid";
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  version: string;
  variables?: string[];
  guardrails?: string[];
  skills?: string[];
  created_at: string;
  updated_at: string;
}

// ─── Node styling ─────────────────────────────────────────────────────────────

const NODE_CONFIG: Record<string, {
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
  label: string;
}> = {
  start:     { color: "text-green-400",    bg: "bg-green-500/10",    border: "border-green-500/30",    icon: Play,          label: "Start" },
  message:   { color: "text-blue-400",     bg: "bg-blue-500/10",     border: "border-blue-500/30",     icon: MessageSquare, label: "Message" },
  input:     { color: "text-purple-400",   bg: "bg-purple-500/10",   border: "border-purple-500/30",   icon: CornerDownRight, label: "Collect Input" },
  condition: { color: "text-orange-400",   bg: "bg-orange-500/10",   border: "border-orange-500/30",   icon: GitBranch,     label: "Branch" },
  action:    { color: "text-yellow-400",   bg: "bg-yellow-500/10",   border: "border-yellow-500/30",   icon: Zap,           label: "Action" },
  api:       { color: "text-cyan-400",     bg: "bg-cyan-500/10",     border: "border-cyan-500/30",     icon: Code,          label: "API Call" },
  intent:    { color: "text-teal-400",     bg: "bg-teal-500/10",     border: "border-teal-500/30",     icon: Search,        label: "Intent Classify" },
  transfer:  { color: "text-red-400",      bg: "bg-red-500/10",      border: "border-red-500/30",      icon: Users,         label: "Transfer" },
  end:       { color: "text-muted-foreground", bg: "bg-white/5",     border: "border-white/10",         icon: CheckCircle,   label: "End" },
};

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-500/10 text-green-400 border-green-500/20",
  draft:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  archived: "bg-white/5 text-muted-foreground border-white/10",
};

const MODE_COLORS: Record<string, string> = {
  deterministic: "text-blue-400",
  llm: "text-purple-400",
  hybrid: "text-teal-400",
};

// ─── Journey Graph Viewer ────────────────────────────────────────────────────

function NodeCard({ node, outEdges }: { node: JourneyNode; outEdges: JourneyEdge[] }) {
  const cfg = NODE_CONFIG[node.type] ?? NODE_CONFIG.action;
  const Icon = cfg.icon;

  return (
    <div className="relative">
      <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`p-1 rounded-lg ${cfg.bg} shrink-0`}>
            <Icon className={`w-3 h-3 ${cfg.color}`} />
          </div>
          <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
          <code className="text-[9px] text-muted-foreground/60 ml-auto">{node.id}</code>
        </div>

        <p className="text-xs font-medium mb-1 text-foreground">{node.label || cfg.label}</p>

        {/* Node data display */}
        {node.data && (
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            {node.data.text && (
              <p className="italic">&ldquo;{node.data.text.slice(0, 80)}{node.data.text.length > 80 ? "…" : ""}&rdquo;</p>
            )}
            {node.data.prompt && (
              <p><span className="text-purple-400">Ask:</span> {node.data.prompt.slice(0, 60)}</p>
            )}
            {node.data.variable && node.data.prompt && (
              <p><span className="text-purple-400">→ store in:</span> <code className="font-mono text-foreground">{node.data.variable}</code></p>
            )}
            {node.data.condition && !node.data.prompt && (
              <p><span className="text-orange-400">when</span> <code className="font-mono text-foreground">{node.data.variable}</code> <span className="text-orange-400">{node.data.condition}</span></p>
            )}
            {node.data.action === "set_variable" && (
              <p><code className="font-mono text-foreground">{node.data.variable}</code> <span className="text-yellow-400">:=</span> <code className="font-mono">{node.data.value}</code></p>
            )}
            {node.data.endpoint && (
              <p><span className="text-cyan-400">POST</span> <code className="font-mono text-foreground">{node.data.endpoint}</code></p>
            )}
            {node.data.department && (
              <p><span className="text-red-400">→</span> {node.data.department}{node.data.reason ? `: ${node.data.reason}` : ""}</p>
            )}
          </div>
        )}
      </div>

      {/* Outgoing edge labels for condition branches */}
      {outEdges.length > 1 && (
        <div className="mt-1.5 ml-3 space-y-0.5">
          {outEdges.map(e => (
            <div key={e.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ArrowRight className="w-2.5 h-2.5 text-orange-400/60 shrink-0" />
              {e.condition && <code className="text-orange-400/80">{e.condition}</code>}
              {e.label && <span className="text-muted-foreground/60">{e.label}</span>}
              <span className="text-muted-foreground/40">→</span>
              <code className="text-foreground/60">{e.target}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyGraph({ journey }: { journey: Journey }) {
  const nodes = journey.nodes ?? [];
  const edges = journey.edges ?? [];

  // Topological sort for display order
  const edgeMap = new Map<string, JourneyEdge[]>();
  const inDegree = new Map<string, number>();
  nodes.forEach(n => { edgeMap.set(n.id, []); inDegree.set(n.id, 0); });
  edges.forEach(e => {
    edgeMap.get(e.source)?.push(e);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  });

  const ordered: JourneyNode[] = [];
  const queue = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0 || n.type === "start");
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    ordered.push(node);
    const out = edgeMap.get(node.id) ?? [];
    out.forEach(e => {
      const target = nodes.find(n => n.id === e.target);
      if (target && !visited.has(target.id)) queue.push(target);
    });
  }

  // Add any unvisited nodes at end
  nodes.forEach(n => { if (!visited.has(n.id)) ordered.push(n); });

  if (ordered.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-muted-foreground">
        No nodes in this journey yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {ordered.map((node, i) => {
        const outEdges = edgeMap.get(node.id) ?? [];
        const isLast = i === ordered.length - 1;
        return (
          <div key={node.id}>
            <NodeCard node={node} outEdges={outEdges} />
            {!isLast && outEdges.length <= 1 && (
              <div className="flex justify-center py-1.5">
                <div className="w-px h-4 bg-white/10" />
              </div>
            )}
            {!isLast && outEdges.length > 1 && (
              <div className="flex justify-center py-1.5">
                <div className="w-px h-2 bg-orange-400/20" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Journey | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/journeys");
      const data = await res.json();
      const jList: Journey[] = data.journeys ?? [];
      setJourneys(jList);
      if (jList.length > 0 && !selected) setSelected(jList[0]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await fetch(`/api/journeys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setJourneys(prev => prev.map(j => j.id === id ? { ...j, status: status as Journey["status"] } : j));
      if (selected?.id === id) setSelected(s => s ? { ...s, status: status as Journey["status"] } : s);
    } finally {
      setUpdating(null);
    }
  }

  async function deleteJourney(id: string) {
    if (!confirm("Delete this journey? This cannot be undone.")) return;
    await fetch(`/api/journeys/${id}`, { method: "DELETE" }).catch(() => {});
    setJourneys(prev => prev.filter(j => j.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const filtered = journeys.filter(j => filter === "all" || j.status === filter);
  const activeCount = journeys.filter(j => j.status === "active").length;

  return (
    <div className="flex h-screen overflow-hidden pt-16">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-card/50">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-[#c4a574]" />
              <span className="text-sm font-semibold">Journeys</span>
              {activeCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{activeCount} live</span>
              )}
            </div>
            <Link href="/studio/ghostwriter">
              <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" /> New
              </Button>
            </Link>
          </div>
          <div className="flex gap-0.5">
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
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Workflow className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No journeys yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Use Ghostwriter to generate from plain English</p>
            </div>
          ) : filtered.map(j => (
            <button
              key={j.id}
              onClick={() => setSelected(j)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selected?.id === j.id ? "bg-[#c4a574]/10 border border-[#c4a574]/30" : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {j.status === "active" && <Star className="w-2.5 h-2.5 text-[#c4a574] shrink-0" />}
                <span className="text-xs font-medium truncate">{j.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1 py-0.5 rounded border ${STATUS_STYLES[j.status]}`}>{j.status}</span>
                <span className={`text-[9px] ${MODE_COLORS[j.execution_mode] ?? "text-muted-foreground"}`}>{j.execution_mode}</span>
                <span className="text-[9px] text-muted-foreground/60">{j.nodes?.length ?? 0} nodes</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main panel */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            {/* Journey header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold">{selected.name}</h1>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                </div>
                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className={MODE_COLORS[selected.execution_mode]}>{selected.execution_mode} mode</span>
                  <span>·</span>
                  <span>{selected.nodes?.length ?? 0} nodes, {selected.edges?.length ?? 0} edges</span>
                  <span>·</span>
                  <span>v{selected.version}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(selected.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => changeStatus(selected.id, "active")}
                    disabled={updating === selected.id}
                    className="bg-green-600 hover:bg-green-700 gap-1 h-7 text-xs"
                  >
                    {updating === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Activate
                  </Button>
                )}
                {selected.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(selected.id, "archived")}
                    disabled={updating === selected.id}
                    className="gap-1 h-7 text-xs text-muted-foreground"
                  >
                    {updating === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                    Archive
                  </Button>
                )}
                {selected.status === "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(selected.id, "draft")}
                    disabled={updating === selected.id}
                    className="gap-1 h-7 text-xs"
                  >
                    Restore
                  </Button>
                )}
                <button
                  onClick={() => deleteJourney(selected.id)}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Variables / skills / guardrails */}
            {((selected.variables?.length ?? 0) > 0 || (selected.skills?.length ?? 0) > 0 || (selected.guardrails?.length ?? 0) > 0) && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(selected.variables?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {(selected.variables ?? []).map(v => (
                        <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono">{v}</code>
                      ))}
                    </div>
                  </div>
                )}
                {(selected.skills?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Tools</p>
                    <div className="flex flex-wrap gap-1">
                      {(selected.skills ?? []).map(s => (
                        <code key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/10 text-[#c4a574] font-mono">{s}</code>
                      ))}
                    </div>
                  </div>
                )}
                {(selected.guardrails?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Guardrails</p>
                    <div className="space-y-0.5">
                      {(selected.guardrails ?? []).slice(0, 3).map((g, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground truncate">{g}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Graph */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium">Workflow Graph</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500/20 border border-orange-500/40" /> Branch</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500/20 border border-blue-500/40" /> Message</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/20 border border-red-500/40" /> Transfer</span>
                </div>
              </div>
              <JourneyGraph journey={selected} />
            </div>

            {/* Create from this template */}
            <div className="mt-4 flex items-center gap-3">
              <Link href="/studio/ghostwriter">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                  <Zap className="w-3 h-3 text-[#c4a574]" /> Generate similar journey
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <Workflow className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Select a journey to view its workflow</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Or generate one with Ghostwriter</p>
            <Link href="/studio/ghostwriter" className="inline-block mt-4">
              <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 text-xs">
                <Plus className="w-3 h-3" /> Generate Journey
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
