"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, CheckCircle, AlertCircle, ChevronRight, ChevronDown,
  ArrowRight, Plus, Clock, Zap, GitBranch, MessageSquare, RefreshCw,
  Copy, ExternalLink, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface JourneyNode {
  id: string;
  type: string;
  label?: string;
  data?: Record<string, unknown>;
}

interface Journey {
  id: string;
  name: string;
  description: string;
  status: string;
  execution_mode: string;
  nodes: JourneyNode[];
  edges: { id: string; source: string; target: string; label?: string }[];
  variables: Record<string, unknown>;
  version: string;
  created_at: string;
}

interface GenerateResult {
  journey?: Journey;
  generated?: { name: string; description: string; nodes: JourneyNode[]; edges: unknown[] };
  validation?: { warnings: string[] };
  saved: boolean;
  error?: string;
  issues?: string[];
}

const NODE_TYPE_COLORS: Record<string, string> = {
  start: "bg-green-500/10 border-green-500/30 text-green-400",
  end: "bg-red-500/10 border-red-500/30 text-red-400",
  message: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  condition: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  action: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  collect: "bg-teal-500/10 border-teal-500/30 text-teal-400",
  escalate: "bg-red-500/10 border-red-500/30 text-red-400",
  llm: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  default: "bg-white/5 border-white/10 text-muted-foreground",
};

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  start: Zap,
  end: CheckCircle,
  message: MessageSquare,
  condition: GitBranch,
  action: ArrowRight,
  collect: Plus,
  escalate: AlertCircle,
  llm: Sparkles,
};

const EXAMPLES = [
  "Onboard new users by collecting their name, company size, and primary use case, then route to the right sales rep",
  "Handle refund requests by verifying order details, checking policy eligibility, and processing approved refunds automatically",
  "Triage support tickets by detecting intent, checking knowledge base, answering if possible, escalating complex issues to human agents",
  "Qualify sales leads by asking about budget, timeline, and pain points, then book a demo or nurture based on score",
  "Collect CSAT feedback after conversation close, detect negative sentiment, and trigger follow-up workflows",
];

function NodeCard({ node, index }: { node: JourneyNode; index: number }) {
  const colorClass = NODE_TYPE_COLORS[node.type] ?? NODE_TYPE_COLORS.default;
  const Icon = NODE_TYPE_ICONS[node.type] ?? ChevronRight;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-start gap-3 p-3 rounded-lg border ${colorClass}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-0.5">{node.type}</div>
        <div className="text-sm font-medium">{node.label || node.id}</div>
        {node.data && Object.keys(node.data).length > 0 && (
          <div className="mt-1 space-y-0.5">
            {Object.entries(node.data).slice(0, 3).map(([k, v]) => (
              <div key={k} className="text-xs opacity-60 truncate">
                <span className="font-medium">{k}:</span>{" "}
                {typeof v === "string" ? v : JSON.stringify(v)}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function GhostwriterPage() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [recentJourneys, setRecentJourneys] = useState<Journey[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/journeys")
      .then(r => r.json())
      .then(d => setRecentJourneys((d.journeys ?? []).slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoadingJourneys(false));
  }, []);

  async function generate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/ghostwriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt.trim() }),
      });
      const data = await res.json();
      setResult(data);
      if (data.saved && data.journey) {
        setRecentJourneys(prev => [data.journey, ...prev].slice(0, 6));
      }
    } catch {
      setResult({ saved: false, error: "Network error — please try again." });
    } finally {
      setGenerating(false);
    }
  }

  function useExample(ex: string) {
    setPrompt(ex);
    setResult(null);
    textareaRef.current?.focus();
  }

  const nodes = result?.journey?.nodes ?? result?.generated?.nodes ?? [];
  const edges = result?.journey?.edges ?? result?.generated?.edges ?? [];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-5 h-5 text-[#c4a574]" />
          <h1 className="text-2xl font-semibold">Ghostwriter</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/20">AI</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Describe what you want your AI agent to do in plain English. Ghostwriter generates a complete, executable journey.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#c4a574]" />
              <span className="text-sm font-medium">Describe your agent</span>
            </div>
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
                }}
                placeholder="Describe what your AI agent should do. Be specific about the goal, the steps, and how it should handle edge cases…"
                className="w-full h-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
              />
            </div>
            <div className="px-4 pb-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{prompt.length} chars · ⌘↵ to generate</span>
              <Button
                onClick={generate}
                disabled={generating || !prompt.trim()}
                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Generate Journey</>
                )}
              </Button>
            </div>
          </div>

          {/* Example prompts */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Try an example</p>
            <div className="space-y-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => useExample(ex)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-2.5 rounded-lg border border-border hover:border-white/20 hover:bg-white/5 transition-colors flex items-start gap-2"
                >
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#c4a574]" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result / recent panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Generation result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                {result.error ? (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Generation failed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{result.error}</p>
                    {result.issues && (
                      <ul className="text-xs text-red-400/80 space-y-0.5">
                        {result.issues.map((iss, i) => <li key={i}>• {iss}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium truncate">
                          {result.journey?.name ?? result.generated?.name ?? "Generated Journey"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {result.saved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                            Saved
                          </span>
                        )}
                        <button
                          onClick={() => setShowRaw(!showRaw)}
                          className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
                          title="Toggle raw JSON"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {result.generated?.description || result.journey?.description ? (
                      <p className="px-4 pt-3 text-xs text-muted-foreground">
                        {result.journey?.description ?? result.generated?.description}
                      </p>
                    ) : null}

                    {result.validation?.warnings && result.validation.warnings.length > 0 && (
                      <div className="mx-4 mt-3 p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                        {result.validation.warnings.map((w, i) => (
                          <p key={i} className="text-[10px] text-yellow-400">⚠ {w}</p>
                        ))}
                      </div>
                    )}

                    {showRaw ? (
                      <div className="m-4 p-3 bg-black/30 rounded-lg max-h-64 overflow-y-auto">
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(result.journey ?? result.generated, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                          {nodes.length} nodes · {(edges as unknown[]).length} edges
                        </p>
                        {nodes.map((node, i) => (
                          <NodeCard key={node.id} node={node} index={i} />
                        ))}
                      </div>
                    )}

                    {result.saved && result.journey && (
                      <div className="px-4 pb-4 pt-2">
                        <Link href="/studio/flows">
                          <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                            <ExternalLink className="w-3.5 h-3.5" />
                            View in Flows
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {!result && generating && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-[#c4a574]/20 border-t-[#c4a574] animate-spin" />
                  <Sparkles className="w-4 h-4 text-[#c4a574] absolute inset-0 m-auto" />
                </div>
                <p className="text-sm font-medium">Building your journey…</p>
                <p className="text-xs text-muted-foreground">Analyzing intent, designing nodes, validating flow</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent journeys */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Recent Journeys
              </span>
              <Link href="/studio/flows" className="text-xs text-[#c4a574] hover:underline">
                View all →
              </Link>
            </div>
            {loadingJourneys ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentJourneys.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No journeys yet. Generate your first one above.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentJourneys.map(j => (
                  <div key={j.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{j.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{j.description || "No description"}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        j.status === "active" ? "bg-green-500/10 text-green-400" :
                        j.status === "draft" ? "bg-white/5 text-muted-foreground" :
                        "bg-white/5 text-muted-foreground"
                      }`}>
                        {j.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{(j.nodes ?? []).length} nodes</span>
                      <span>·</span>
                      <span>{j.execution_mode}</span>
                      <span>·</span>
                      <span>{new Date(j.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
