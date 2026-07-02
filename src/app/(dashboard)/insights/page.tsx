"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Star, Clock, MessageSquare, DollarSign,
  AlertTriangle, CheckCircle, Loader2, RefreshCw, Zap, Brain,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Kpis {
  totalConversations: number;
  resolutionRate: number;
  avgResponseTime: number;
  csat: number;
  csatRatings: number;
  csatDistribution: Record<string, number> | null;
  totalTokens: number;
  totalCostUsd: number;
  tokensByModel: Record<string, number>;
}

interface TrendRow {
  id: string;
  date: string;
  metric: string;
  value: number;
  metadata?: Record<string, unknown>;
}

interface FlaggedConv {
  id: string;
  conversation_id: string;
  reason: string;
  severity: string;
  created_at: string;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-blue-400",
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-white/5 shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            {trend === "up" && <ArrowUpRight className="w-3 h-3 text-green-400" />}
            {trend === "down" && <ArrowDownRight className="w-3 h-3 text-red-400" />}
            <span className="text-muted-foreground">{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CsatBar({ score, count, total }: { score: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const stars = "★".repeat(score) + "☆".repeat(5 - score);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-yellow-400 shrink-0 w-20">{stars}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#c4a574] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
    </div>
  );
}

export default function InsightsPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [flagged, setFlagged] = useState<FlaggedConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis ?? null);
        setTrends(data.trends ?? []);
        setFlagged(data.flagged ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group trends by metric
  const trendsByMetric: Record<string, TrendRow[]> = {};
  for (const row of trends) {
    if (!trendsByMetric[row.metric]) trendsByMetric[row.metric] = [];
    trendsByMetric[row.metric].push(row);
  }

  const csatDist = kpis?.csatDistribution ?? {};
  const totalCsat = Object.values(csatDist).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Insights 2.0</h1>
          </div>
          <p className="text-sm text-muted-foreground">AI-powered performance intelligence for your support team.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI grid */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <KpiCard
              icon={MessageSquare}
              label="Total Conversations"
              value={(kpis?.totalConversations ?? 0).toLocaleString()}
              color="text-blue-400"
            />
            <KpiCard
              icon={CheckCircle}
              label="Resolution Rate"
              value={`${kpis?.resolutionRate ?? 0}%`}
              color="text-green-400"
              sub="of all conversations resolved by AI"
              trend={kpis && kpis.resolutionRate >= 80 ? "up" : "neutral"}
            />
            <KpiCard
              icon={Clock}
              label="Avg Response Time"
              value={kpis?.avgResponseTime ? `${kpis.avgResponseTime}s` : "—"}
              color="text-purple-400"
            />
            <KpiCard
              icon={Star}
              label="CSAT Score"
              value={kpis?.csat ? `${kpis.csat}/5` : "—"}
              sub={kpis?.csatRatings ? `${kpis.csatRatings} ratings` : undefined}
              color="text-yellow-400"
              trend={kpis && kpis.csat >= 4 ? "up" : "down"}
            />
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Token cost */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="font-medium text-sm">AI Usage (30d)</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total tokens</span>
                  <span className="font-medium">{((kpis?.totalTokens ?? 0) / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total cost</span>
                  <span className="font-medium text-[#c4a574]">${(kpis?.totalCostUsd ?? 0).toFixed(4)}</span>
                </div>
                {kpis?.tokensByModel && Object.keys(kpis.tokensByModel).length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">By Model</p>
                    {Object.entries(kpis.tokensByModel).slice(0, 4).map(([model, tokens]) => (
                      <div key={model} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[60%]">{model}</span>
                        <span>{((tokens as number) / 1000).toFixed(1)}K</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* CSAT distribution */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-yellow-400" />
                <h3 className="font-medium text-sm">CSAT Distribution</h3>
              </div>
              {totalCsat === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No ratings yet</p>
              ) : (
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map(score => (
                    <CsatBar
                      key={score}
                      score={score}
                      count={csatDist[score] ?? 0}
                      total={totalCsat}
                    />
                  ))}
                  <p className="text-[10px] text-muted-foreground text-right pt-1">{totalCsat} total ratings</p>
                </div>
              )}
            </motion.div>

            {/* Flagged conversations */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h3 className="font-medium text-sm">Flagged Conversations</h3>
                {flagged.length > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                    {flagged.length}
                  </span>
                )}
              </div>
              {flagged.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No flagged conversations</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {flagged.slice(0, 8).map(f => (
                    <div key={f.id} className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <p className="text-xs font-medium">{f.reason}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1 rounded ${
                          f.severity === "critical" ? "text-red-400 bg-red-500/10" :
                          f.severity === "high" ? "text-orange-400 bg-orange-500/10" :
                          "text-yellow-400 bg-yellow-500/10"
                        }`}>{f.severity}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Trends table */}
          {trends.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#c4a574]" />
                <h3 className="font-medium text-sm">Daily Trends (last {trends.length} days)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Date</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Metric</th>
                      <th className="text-right px-5 py-3 text-xs text-muted-foreground font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.slice(0, 15).map(row => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">
                          {new Date(row.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-2.5 text-xs capitalize">{row.metric.replace(/_/g, " ")}</td>
                        <td className="px-5 py-2.5 text-xs text-right font-medium">
                          {typeof row.value === "number" && row.metric.includes("rate")
                            ? `${(row.value * 100).toFixed(1)}%`
                            : row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
