"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, Users, MessageSquare, Clock, Star,
  AlertTriangle, Zap, RefreshCw, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ConvSeries {
  period: string;
  total: number;
  resolved: number;
  escalated: number;
  resolution_rate: number;
  sentiment: { positive: number; neutral: number; negative: number };
}

interface AnalyticsData {
  series: ConvSeries[];
  channels: { channel: string; total: number }[];
  top_intents: { intent: string; total: number }[];
  since: string;
  period_days: number;
}

interface AgentKpi {
  agent_id: string;
  total_conversations: number;
  resolved: number;
  escalated: number;
  resolution_rate: number;
  escalation_rate: number;
  avg_handle_time_mins: number;
  avg_csat: number | null;
  csat_count: number;
}

interface AgentData {
  agents: AgentKpi[];
  token_usage_by_sub_agent: { agent_type: string; total_tokens: number; total_cost_usd: number; call_count: number }[];
}

interface LiveSnapshot {
  open_conversations: number;
  escalated_conversations: number;
  closed_last_hour: number;
  avg_handle_time_mins: number;
  messages_last_hour: number;
  online_agents: number;
  sampled_at: string;
}

const DAYS_OPTIONS = [1, 7, 30, 90];

function KpiCard({ icon: Icon, label, value, sub, color = "text-blue-500" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}><Icon size={16} /></div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [conv, setConv] = useState<AnalyticsData | null>(null);
  const [agents, setAgents] = useState<AgentData | null>(null);
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [convRes, agentRes] = await Promise.all([
        fetch(`/api/analytics/conversations?days=${days}&granularity=${days <= 2 ? "hour" : "day"}`),
        fetch(`/api/analytics/agents?days=${days}`),
      ]);
      const [cd, ad] = await Promise.all([convRes.json(), agentRes.json()]);
      setConv(cd);
      setAgents(ad);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  // Live SSE
  useEffect(() => {
    const es = new EventSource("/api/analytics/live");
    es.onmessage = (e) => {
      try {
        const { data } = JSON.parse(e.data);
        if (data) setLive(data);
      } catch {}
    };
    return () => es.close();
  }, []);

  const totalConv = conv?.series.reduce((s, r) => s + r.total, 0) ?? 0;
  const totalResolved = conv?.series.reduce((s, r) => s + r.resolved, 0) ?? 0;
  const totalEscalated = conv?.series.reduce((s, r) => s + r.escalated, 0) ?? 0;
  const avgResRate = totalConv > 0 ? totalResolved / totalConv : 0;
  const maxSeriesTotal = Math.max(...(conv?.series.map(s => s.total) ?? [1]), 1);

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-500" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance insights across conversations, agents, and AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${days === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d === 1 ? "24h" : d === 7 ? "7d" : d === 30 ? "30d" : "90d"}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Live strip */}
      {live && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live</span>
            <span className="text-xs text-muted-foreground ml-auto">Updated {new Date(live.sampled_at).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: "Open", value: live.open_conversations, color: "text-green-500" },
              { label: "Escalated", value: live.escalated_conversations, color: "text-red-500" },
              { label: "Closed (1h)", value: live.closed_last_hour, color: "text-gray-500" },
              { label: "Messages (1h)", value: live.messages_last_hour, color: "text-blue-500" },
              { label: "Avg Handle", value: `${live.avg_handle_time_mins.toFixed(0)}m`, color: "text-yellow-500" },
              { label: "Online Agents", value: live.online_agents, color: "text-purple-500" },
            ].map(item => (
              <div key={item.label}>
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={MessageSquare} label="Conversations" value={totalConv} color="text-blue-500" sub={`Last ${days} day${days > 1 ? "s" : ""}`} />
        <KpiCard icon={TrendingUp} label="Resolution Rate" value={`${(avgResRate * 100).toFixed(1)}%`} color="text-green-500" sub={`${totalResolved} resolved`} />
        <KpiCard icon={AlertTriangle} label="Escalations" value={totalEscalated} color="text-red-500" sub={`${totalConv > 0 ? ((totalEscalated / totalConv) * 100).toFixed(1) : 0}% rate`} />
        <KpiCard icon={Zap} label="AI Cost" value={`$${(agents?.token_usage_by_sub_agent.reduce((s, r) => s + r.total_cost_usd, 0) ?? 0).toFixed(2)}`} color="text-yellow-500" sub={`${Math.round((agents?.token_usage_by_sub_agent.reduce((s, r) => s + r.total_tokens, 0) ?? 0) / 1000)}k tokens`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume chart (simple bars) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Conversation Volume</h2>
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
          ) : conv?.series.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
          ) : (
            <div className="space-y-2">
              {conv?.series.slice(-14).map(row => (
                <div key={row.period} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{row.period.slice(5, 10)}</span>
                  <div className="flex-1">
                    <Bar value={row.total} max={maxSeriesTotal} color="bg-blue-500" />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{(row.resolution_rate * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Channel breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Channels</h2>
          {conv?.channels.map(ch => (
            <div key={ch.channel} className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="capitalize">{ch.channel}</span>
                <span>{ch.total}</span>
              </div>
              <Bar value={ch.total} max={conv.channels[0]?.total ?? 1} color="bg-indigo-500" />
            </div>
          ))}
          {(!conv?.channels || conv.channels.length === 0) && (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </div>
      </div>

      {/* Top intents + Agent table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top intents */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top Intents</h2>
          <div className="space-y-3">
            {conv?.top_intents.slice(0, 10).map(item => (
              <div key={item.intent} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground flex-1">{item.intent}</span>
                <Bar value={item.total} max={conv.top_intents[0]?.total ?? 1} color="bg-violet-500" />
                <span className="text-xs text-muted-foreground w-8 text-right">{item.total}</span>
              </div>
            ))}
            {(!conv?.top_intents || conv.top_intents.length === 0) && (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        {/* Agent table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Agent Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-2">Agent</th>
                  <th className="text-right pb-2">Conv</th>
                  <th className="text-right pb-2">Res%</th>
                  <th className="text-right pb-2">CSAT</th>
                </tr>
              </thead>
              <tbody>
                {agents?.agents.slice(0, 8).map(a => (
                  <tr key={a.agent_id} className="border-t border-border">
                    <td className="py-2 text-foreground truncate max-w-[120px]">{a.agent_id}</td>
                    <td className="py-2 text-right text-muted-foreground">{a.total_conversations}</td>
                    <td className="py-2 text-right">
                      <span className={`font-medium ${a.resolution_rate >= 0.8 ? "text-green-500" : a.resolution_rate >= 0.5 ? "text-yellow-500" : "text-red-500"}`}>
                        {(a.resolution_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {a.avg_csat ? a.avg_csat.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
                {(!agents?.agents || agents.agents.length === 0) && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No agent data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI sub-agent token usage */}
      {agents?.token_usage_by_sub_agent && agents.token_usage_by_sub_agent.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">AI Token Usage by Sub-Agent</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2">Sub-Agent</th>
                  <th className="text-right pb-2">Calls</th>
                  <th className="text-right pb-2">Tokens</th>
                  <th className="text-right pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {agents.token_usage_by_sub_agent.map(r => (
                  <tr key={r.agent_type} className="border-t border-border">
                    <td className="py-2 text-foreground capitalize">{r.agent_type ?? "unknown"}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.call_count}</td>
                    <td className="py-2 text-right text-muted-foreground">{Math.round(r.total_tokens / 1000)}k</td>
                    <td className="py-2 text-right text-muted-foreground">${r.total_cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
