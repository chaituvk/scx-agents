"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow, Plus, Loader2, ChevronRight, CheckCircle, Archive,
  Zap, GitBranch, MessageSquare, Clock, Trash2, Edit3, Copy,
  AlertCircle, Play, Pause, MoreHorizontal, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface JourneyNode {
  id: string;
  type: string;
  label?: string;
}

interface Journey {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  execution_mode: "deterministic" | "llm" | "hybrid";
  nodes: JourneyNode[];
  edges: { id: string; source: string; target: string }[];
  version: string;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  active: { chip: "bg-green-500/10 text-green-400 border-green-500/20", dot: "bg-green-400" },
  draft: { chip: "bg-white/5 text-muted-foreground border-white/10", dot: "bg-muted-foreground" },
  archived: { chip: "bg-white/5 text-muted-foreground/40 border-white/5", dot: "bg-muted-foreground/40" },
};

const MODE_STYLES: Record<string, string> = {
  deterministic: "text-blue-400",
  llm: "text-purple-400",
  hybrid: "text-teal-400",
};

const NODE_TYPE_COUNTS = (nodes: JourneyNode[]) => {
  const counts: Record<string, number> = {};
  for (const n of nodes) { counts[n.type] = (counts[n.type] ?? 0) + 1; }
  return counts;
};

function JourneyCard({
  journey,
  onStatusChange,
  onDelete,
  updating,
}: {
  journey: Journey;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  updating: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const st = STATUS_STYLES[journey.status] ?? STATUS_STYLES.draft;
  const nodeCounts = NODE_TYPE_COUNTS(journey.nodes ?? []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl p-5 hover:border-white/20 transition-colors ${
        journey.status === "active" ? "border-[#c4a574]/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
            <h3 className="font-medium text-sm truncate">{journey.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${st.chip}`}>
              {journey.status}
            </span>
            <span className={`text-[10px] shrink-0 ${MODE_STYLES[journey.execution_mode] ?? "text-muted-foreground"}`}>
              {journey.execution_mode}
            </span>
          </div>
          {journey.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{journey.description}</p>
          )}

          {/* Node type breakdown */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(nodeCounts).map(([type, count]) => (
              <span
                key={type}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/60 flex items-center gap-0.5"
              >
                {count}× {type}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {journey.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange("active")}
              disabled={updating}
              className="text-xs h-7 gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Activate
            </Button>
          )}
          {journey.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange("archived")}
              disabled={updating}
              className="text-xs h-7 gap-1 text-muted-foreground"
            >
              {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
              Archive
            </Button>
          )}
          {journey.status === "archived" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange("draft")}
              disabled={updating}
              className="text-xs h-7 gap-1"
            >
              {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
              Restore
            </Button>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-10 overflow-hidden"
                  onBlur={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground border-t border-border pt-3">
        <span>{(journey.nodes ?? []).length} nodes</span>
        <span>·</span>
        <span>{(journey.edges ?? []).length} edges</span>
        <span>·</span>
        <span>v{journey.version}</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {new Date(journey.updated_at).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}

export default function FlowsPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/journeys");
      const data = await res.json();
      setJourneys(data.journeys ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } finally {
      setUpdating(null);
    }
  }

  async function deleteJourney(id: string) {
    if (!confirm("Delete this journey?")) return;
    await fetch(`/api/journeys/${id}`, { method: "DELETE" }).catch(() => {});
    setJourneys(prev => prev.filter(j => j.id !== id));
  }

  const filtered = journeys.filter(j => filter === "all" || j.status === filter);
  const activeCount = journeys.filter(j => j.status === "active").length;
  const draftCount = journeys.filter(j => j.status === "draft").length;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Workflow className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Flows</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage AI conversation journeys. Create new ones via{" "}
            <Link href="/studio/ghostwriter" className="text-[#c4a574] hover:underline">Ghostwriter</Link>.
          </p>
        </div>
        <Link href="/studio/ghostwriter">
          <Button className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
            <Plus className="w-4 h-4" />
            New Journey
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      {!loading && journeys.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{journeys.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Journeys</div>
          </div>
          <div className="bg-card border border-green-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{activeCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Active</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{draftCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Draft</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "active", "draft", "archived"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
              filter === f ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f} ({f === "all" ? journeys.length : journeys.filter(j => j.status === f).length})
          </button>
        ))}
      </div>

      {/* Journey list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Workflow className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {filter === "all" ? "No journeys yet" : `No ${filter} journeys`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use{" "}
            <Link href="/studio/ghostwriter" className="text-[#c4a574] hover:underline">Ghostwriter</Link>{" "}
            to generate your first journey from a plain English description.
          </p>
          <Link href="/studio/ghostwriter">
            <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]">
              <Plus className="w-4 h-4 mr-1" /> Generate Journey
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(j => (
            <JourneyCard
              key={j.id}
              journey={j}
              onStatusChange={status => changeStatus(j.id, status)}
              onDelete={() => deleteJourney(j.id)}
              updating={updating === j.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
