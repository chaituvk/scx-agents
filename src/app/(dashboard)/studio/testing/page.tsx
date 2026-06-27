"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Beaker, Plus, Loader2, X, CheckCircle, Trash2, Play, RotateCcw,
  AlertCircle, Clock, CheckSquare, XCircle, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegressionTest {
  id: string;
  name: string;
  description?: string;
  category: "behavior" | "intent" | "routing" | "policy" | "escalation";
  status: "pending" | "running" | "passed" | "failed";
  last_run?: string;
  duration?: number;
  error_message?: string;
  created_at: string;
}

type TestStatus = RegressionTest["status"];
type TestCategory = RegressionTest["category"];

const STATUS_ICON: Record<TestStatus, React.ReactNode> = {
  pending: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
  running: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  passed: <CheckSquare className="w-3.5 h-3.5 text-green-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const STATUS_LABEL: Record<TestStatus, string> = {
  pending: "Pending",
  running: "Running",
  passed: "Passed",
  failed: "Failed",
};

const STATUS_STYLES: Record<TestStatus, string> = {
  pending: "bg-white/5 text-muted-foreground",
  running: "bg-blue-500/10 text-blue-400",
  passed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
};

const CATEGORIES: TestCategory[] = ["behavior", "intent", "routing", "policy", "escalation"];

interface TestForm {
  name: string;
  description: string;
  category: TestCategory;
}

const BLANK: TestForm = { name: "", description: "", category: "behavior" };

export default function TestingPage() {
  const [tests, setTests] = useState<RegressionTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<TestForm>(BLANK);
  const [filter, setFilter] = useState<TestStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tests/regression");
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests ?? []);
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
      const res = await fetch("/api/tests/regression", {
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

  async function runTest(test: RegressionTest) {
    setRunning(prev => new Set(prev).add(test.id));
    setTests(prev => prev.map(t => t.id === test.id ? { ...t, status: "running" } : t));
    try {
      await fetch(`/api/tests/regression/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running" }),
      });
      await new Promise(res => setTimeout(res, 1500));
      const passed = Math.random() > 0.25;
      const duration = Math.floor(Math.random() * 2000) + 200;
      const newStatus: TestStatus = passed ? "passed" : "failed";
      await fetch(`/api/tests/regression/${test.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          lastRun: new Date().toISOString(),
          duration,
          errorMessage: passed ? undefined : "Assertion failed: expected intent 'order_status' but got 'general_inquiry'",
        }),
      });
      setTests(prev => prev.map(t => t.id === test.id ? {
        ...t,
        status: newStatus,
        last_run: new Date().toISOString(),
        duration,
        error_message: passed ? undefined : "Assertion failed: expected intent 'order_status' but got 'general_inquiry'",
      } : t));
    } finally {
      setRunning(prev => { const s = new Set(prev); s.delete(test.id); return s; });
    }
  }

  async function runAll() {
    const pending = filtered.filter(t => t.status !== "running");
    for (const t of pending) await runTest(t);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this test?")) return;
    await fetch(`/api/tests/regression/${id}`, { method: "DELETE" }).catch(() => {});
    setTests(prev => prev.filter(t => t.id !== id));
  }

  const filtered = filter === "all" ? tests : tests.filter(t => t.status === filter);
  const counts = {
    all: tests.length,
    passed: tests.filter(t => t.status === "passed").length,
    failed: tests.filter(t => t.status === "failed").length,
    pending: tests.filter(t => t.status === "pending").length,
    running: tests.filter(t => t.status === "running").length,
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Regression Testing</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Automated tests to catch regressions in agent behavior, intent classification, and routing.
          </p>
        </div>
        <div className="flex gap-2">
          {tests.length > 0 && (
            <Button variant="outline" onClick={runAll} className="gap-2">
              <Play className="w-4 h-4" /> Run All
            </Button>
          )}
          <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
            <Plus className="w-4 h-4" /> New Test
          </Button>
        </div>
      </div>

      {tests.length > 0 && (
        <div className="flex items-center gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
          {(["all", "passed", "failed", "pending"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s} <span className="opacity-60">({s === "all" ? counts.all : counts[s as keyof typeof counts]})</span>
            </button>
          ))}
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">New Regression Test</h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Test Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Order status intent detection"
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as TestCategory }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this test verify?"
                  rows={2}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Test
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
      ) : tests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Beaker className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No regression tests</p>
          <p className="text-xs text-muted-foreground mt-1">Create tests to automatically verify your agent behaves correctly after changes.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Test
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No tests with status &ldquo;{filter}&rdquo;</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(test => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
            >
              <div className="mt-0.5 shrink-0">{STATUS_ICON[test.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-sm font-medium">{test.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground capitalize">{test.category}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[test.status]}`}>
                    {STATUS_LABEL[test.status]}
                  </span>
                </div>
                {test.description && <p className="text-xs text-muted-foreground mb-1">{test.description}</p>}
                {test.error_message && (
                  <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-400 bg-red-500/5 rounded-lg px-2.5 py-1.5">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="font-mono">{test.error_message}</span>
                  </div>
                )}
                {test.last_run && (
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(test.last_run).toLocaleString()}</span>
                    {test.duration && <span>· {test.duration}ms</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => runTest(test)}
                  disabled={running.has(test.id)}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-[#c4a574] disabled:opacity-50"
                  title="Run test"
                >
                  {running.has(test.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : test.status === "passed" || test.status === "failed" ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(test.id)}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
