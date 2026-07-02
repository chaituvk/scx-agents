"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare, Users, AlertCircle, CheckCircle, Clock, TrendingUp,
  Zap, ArrowRight, RefreshCw, Loader2, Flame, Star, BarChart3,
  Brain, ScrollText, Plug, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveSnapshot {
  open_conversations: number;
  escalated_conversations: number;
  closed_last_hour: number;
  avg_handle_time_mins: number;
  messages_last_hour: number;
  online_agents: number;
  sampled_at: string;
}

interface EscalatedConv {
  id: string;
  customer_name: string;
  customer_email: string;
  channel: string;
  priority: string;
  updated_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
}

const QUICK_LINKS = [
  { href: "/inbox", icon: Inbox, label: "Inbox", desc: "View all conversations" },
  { href: "/handover", icon: AlertCircle, label: "Handover Queue", desc: "Escalated conversations" },
  { href: "/customers", icon: Users, label: "Customers", desc: "Customer profiles & memory" },
  { href: "/analytics", icon: BarChart3, label: "Analytics", desc: "Performance metrics" },
  { href: "/studio/playbooks", icon: ScrollText, label: "Playbooks", desc: "Manage AI playbooks" },
  { href: "/integrations", icon: Plug, label: "Integrations", desc: "Connect your stack" },
];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-muted shrink-0 ${color ?? "text-primary"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [recentOpen, setRecentOpen] = useState<EscalatedConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [liveRes, notifRes, convsRes] = await Promise.all([
        fetch("/api/analytics/live").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/notifications?limit=5").then(r => r.json()).catch(() => ({ notifications: [] })),
        fetch("/api/conversations/search?status=escalated&limit=5").then(r => r.json()).catch(() => ({ conversations: [] })),
      ]);
      if (liveRes?.snapshot) setLive(liveRes.snapshot);
      setAlerts(notifRes.notifications ?? []);
      setRecentOpen(convsRes.conversations ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {live ? `Last updated ${new Date(live.sampled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading live data…"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
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
          {/* Live KPI row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <StatCard icon={MessageSquare} label="Open" value={live?.open_conversations ?? "—"} color="text-blue-500" />
            <StatCard icon={AlertCircle} label="Escalated" value={live?.escalated_conversations ?? "—"} color="text-red-500" />
            <StatCard icon={CheckCircle} label="Closed / hr" value={live?.closed_last_hour ?? "—"} color="text-green-500" />
            <StatCard icon={Zap} label="Msgs / hr" value={live?.messages_last_hour ?? "—"} color="text-yellow-500" />
            <StatCard icon={Clock} label="Avg handle" value={live ? `${live.avg_handle_time_mins}m` : "—"} color="text-purple-500" />
            <StatCard icon={Users} label="Online agents" value={live?.online_agents ?? "—"} color="text-teal-500" />
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Active alerts */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Needs Attention
                </h2>
                <Link href="/inbox" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
              {alerts.length === 0 && recentOpen.length === 0 ? (
                <div className="rounded-xl border border-border p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium">All clear!</p>
                  <p className="text-xs text-muted-foreground mt-1">No escalations or urgent conversations.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map(n => (
                    <Link
                      key={n.id}
                      href={n.href}
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.type === "escalation" ? "bg-red-500" : "bg-orange-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </Link>
                  ))}
                  {recentOpen.slice(0, 3).map(c => (
                    <Link
                      key={c.id}
                      href="/handover"
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.customer_name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Escalated · {c.channel} · {c.priority} priority · {new Date(c.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Quick navigation */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="font-medium mb-4">Quick Access</h2>
              <div className="space-y-1">
                {QUICK_LINKS.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-muted">
                      <link.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.desc}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
