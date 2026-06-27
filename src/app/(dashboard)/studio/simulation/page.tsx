"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, Loader2, CheckCircle, AlertCircle, Clock,
  ChevronRight, BarChart3, Zap, Brain, MessageSquare, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scenario {
  id: string;
  journeyId?: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  status?: string;
  mode?: string;
  turns?: { role: string; content: string }[];
}

interface RunResult {
  scenario_id: string;
  passed: boolean;
  score: number;
  turns_completed: number;
  total_turns: number;
  metrics: {
    resolution_rate: number;
    escalation_rate: number;
    avg_latency_ms: number;
    policy_violations: number;
    fallback_rate: number;
  };
  turn_results: { turn: number; passed: boolean; latency_ms: number; notes?: string }[];
  summary: string;
  error?: string;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-green-500/10 text-green-400 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  hard: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function SimulationPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [suiteRunning, setSuiteRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/simulations/scenarios");
      const data = await res.json();
      setScenarios(data.scenarios ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runScenario(scenario: Scenario) {
    setRunning(scenario.id);
    try {
      const res = await fetch("/api/simulations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenario.id, journey_id: scenario.journeyId }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(prev => new Map(prev).set(scenario.id, data.result ?? data));
        setSelectedResult(scenario.id);
      }
    } finally {
      setRunning(null);
    }
  }

  async function runSuite() {
    setSuiteRunning(true);
    try {
      const res = await fetch("/api/simulations/run-suite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_ids: scenarios.map(s => s.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        const newResults = new Map(results);
        for (const r of data.results ?? []) {
          newResults.set(r.scenario_id, r);
        }
        setResults(newResults);
      }
    } finally {
      setSuiteRunning(false);
    }
  }

  const passedCount = [...results.values()].filter(r => r.passed).length;
  const totalRun = results.size;

  const resultForSelected = selectedResult ? results.get(selectedResult) : null;
  const scenarioForSelected = selectedResult ? scenarios.find(s => s.id === selectedResult) : null;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Simulation</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Test your AI journeys against predefined scenarios before going live.
          </p>
        </div>
        <Button
          onClick={runSuite}
          disabled={suiteRunning || scenarios.length === 0}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          {suiteRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run All
        </Button>
      </div>

      {/* Suite summary */}
      {totalRun > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{totalRun}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Scenarios Run</div>
          </div>
          <div className={`bg-card border rounded-xl p-4 text-center ${passedCount === totalRun ? "border-green-500/30" : "border-border"}`}>
            <div className={`text-2xl font-bold ${passedCount === totalRun ? "text-green-400" : "text-yellow-400"}`}>{passedCount}/{totalRun}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Passed</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">
              {Math.round([...results.values()].reduce((sum, r) => sum + (r.score ?? 0), 0) / totalRun)}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Avg Score</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scenario list */}
        <div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : scenarios.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <FlaskConical className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No scenarios</p>
              <p className="text-xs text-muted-foreground mt-1">Create journeys first — scenarios are generated from them.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scenarios.map(scenario => {
                const result = results.get(scenario.id);
                return (
                  <motion.div
                    key={scenario.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-card border rounded-xl p-4 cursor-pointer hover:border-white/20 transition-colors ${
                      selectedResult === scenario.id ? "border-[#c4a574]/40" : "border-border"
                    }`}
                    onClick={() => result && setSelectedResult(scenario.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {result ? (
                            result.passed ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate">{scenario.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${DIFFICULTY_STYLES[scenario.difficulty] ?? ""}`}>
                            {scenario.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 ml-5">{scenario.description}</p>
                        {result && (
                          <div className="ml-5 mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className={result.passed ? "text-green-400" : "text-red-400"}>
                              {result.score}%
                            </span>
                            <span>·</span>
                            <span>{result.turns_completed}/{result.total_turns} turns</span>
                            {result.metrics?.policy_violations > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-red-400">{result.metrics.policy_violations} violations</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => { e.stopPropagation(); runScenario(scenario); }}
                        disabled={running === scenario.id}
                        className="text-xs h-7 gap-1 shrink-0"
                      >
                        {running === scenario.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Run
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Result detail */}
        <div>
          <AnimatePresence mode="wait">
            {resultForSelected && scenarioForSelected ? (
              <motion.div
                key={selectedResult}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {resultForSelected.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium">{scenarioForSelected.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${resultForSelected.passed ? "text-green-400" : "text-red-400"}`}>
                      {resultForSelected.score}%
                    </span>
                    <button onClick={() => setSelectedResult(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {resultForSelected.summary && (
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-foreground/80">{resultForSelected.summary}</p>
                    </div>
                  )}

                  {/* Metrics grid */}
                  {resultForSelected.metrics && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Resolution Rate", value: `${Math.round(resultForSelected.metrics.resolution_rate * 100)}%`, good: true },
                        { label: "Escalation Rate", value: `${Math.round(resultForSelected.metrics.escalation_rate * 100)}%`, good: resultForSelected.metrics.escalation_rate < 0.2 },
                        { label: "Avg Latency", value: `${resultForSelected.metrics.avg_latency_ms}ms`, good: resultForSelected.metrics.avg_latency_ms < 2000 },
                        { label: "Policy Violations", value: resultForSelected.metrics.policy_violations, good: resultForSelected.metrics.policy_violations === 0 },
                      ].map(m => (
                        <div key={m.label} className="bg-black/20 rounded-lg p-2.5">
                          <div className={`text-base font-semibold ${m.good ? "text-green-400" : "text-red-400"}`}>{m.value}</div>
                          <div className="text-[10px] text-muted-foreground">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Turn results */}
                  {resultForSelected.turn_results && resultForSelected.turn_results.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Turn Results</p>
                      <div className="space-y-1.5">
                        {resultForSelected.turn_results.map(t => (
                          <div key={t.turn} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${t.passed ? "bg-green-500/5" : "bg-red-500/5"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.passed ? "bg-green-400" : "bg-red-400"}`} />
                            <span className="text-muted-foreground">Turn {t.turn}</span>
                            {t.notes && <span className="flex-1 truncate">{t.notes}</span>}
                            <span className="text-muted-foreground shrink-0">{t.latency_ms}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultForSelected.error && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{resultForSelected.error}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card border border-dashed border-border rounded-xl p-12 text-center"
              >
                <BarChart3 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium">No result selected</p>
                <p className="text-xs text-muted-foreground mt-1">Run a scenario to see detailed results here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
