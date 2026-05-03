"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Search,
  AlertTriangle,
  FlaskConical,
  Activity,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Clock,
  ThumbsUp,
  Filter,
  Download,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

interface KpiData {
  label: string;
  value: string;
  change: string;
  up: boolean;
}

interface TrendData {
  day: string;
  conversations: number;
  resolved: number;
  latency: number;
}

interface FlaggedConv {
  id: string;
  issue: string;
  severity: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  assignee: string;
}

const defaultKpiData: KpiData[] = [
  { label: "Total Conversations", value: "2.4M", change: "+12%", up: true },
  { label: "Resolution Rate", value: "94.2%", change: "+3.1%", up: true },
  { label: "Avg Response Time", value: "1.8s", change: "-0.4s", up: false },
  { label: "CSAT Score", value: "4.8", change: "+0.2", up: true },
];

const defaultTrendData: TrendData[] = [
  { day: "Mon", conversations: 3200, resolved: 2980, latency: 2.1 },
  { day: "Tue", conversations: 3500, resolved: 3250, latency: 1.9 },
  { day: "Wed", conversations: 3100, resolved: 2900, latency: 2.0 },
  { day: "Thu", conversations: 3800, resolved: 3600, latency: 1.7 },
  { day: "Fri", conversations: 4200, resolved: 3980, latency: 1.6 },
  { day: "Sat", conversations: 2800, resolved: 2650, latency: 1.8 },
  { day: "Sun", conversations: 2600, resolved: 2450, latency: 1.9 },
];

const toolCallData = [
  { name: "CRM Lookup", calls: 4500 },
  { name: "Order API", calls: 3200 },
  { name: "Knowledge Base", calls: 2800 },
  { name: "Refund", calls: 1200 },
  { name: "Escalation", calls: 800 },
];

const sentimentData = [
  { name: "Positive", value: 68, color: "#c4a574" },
  { name: "Neutral", value: 22, color: "#8b7355" },
  { name: "Negative", value: 10, color: "#dc2626" },
];

const defaultFlagged: FlaggedConv[] = [
  { id: "#48291", issue: "Refund dispute over $2,400", severity: "High", status: "Open", assignee: "Sarah M." },
  { id: "#48285", issue: "Account locked after 3 attempts", severity: "High", status: "In Progress", assignee: "James K." },
  { id: "#48272", issue: "Shipping delay complaint", severity: "Medium", status: "Open", assignee: "Unassigned" },
  { id: "#48261", issue: "Product defect report", severity: "Medium", status: "Resolved", assignee: "Lisa T." },
  { id: "#48255", issue: "Billing confusion", severity: "Low", status: "Open", assignee: "Mike R." },
];

const experiments = [
  {
    name: "Return Policy Wording",
    variantA: { rate: 78, label: "Direct" },
    variantB: { rate: 86, label: "Empathetic" },
    winner: "B",
    confidence: 97,
  },
  {
    name: "Upsell Timing",
    variantA: { rate: 12, label: "Early" },
    variantB: { rate: 18, label: "After Resolution" },
    winner: "B",
    confidence: 94,
  },
  {
    name: "Greeting Style",
    variantA: { rate: 82, label: "Formal" },
    variantB: { rate: 81, label: "Casual" },
    winner: null,
    confidence: 62,
  },
];

const severityColor = (s: string) => {
  if (s === "High") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "Medium") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-green-500/20 text-green-400 border-green-500/30";
};

const statusIcon = (s: string) => {
  if (s === "Resolved") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (s === "In Progress") return <Clock className="h-4 w-4 text-yellow-400" />;
  return <AlertTriangle className="h-4 w-4 text-red-400" />;
};

export default function InsightsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [kpiData, setKpiData] = useState<KpiData[]>(defaultKpiData);
  const [trendData, setTrendData] = useState<TrendData[]>(defaultTrendData);
  const [flaggedConversations, setFlaggedConversations] = useState<FlaggedConv[]>(defaultFlagged);

  useEffect(() => {
    fetch("/api/insights")
      .then((res) => res.json())
      .then((data) => {
        if (data.kpis) {
          setKpiData([
            { label: "Total Conversations", value: data.kpis.totalConversations.toLocaleString(), change: "+12%", up: true },
            { label: "Resolution Rate", value: `${data.kpis.resolutionRate}%`, change: "+3.1%", up: true },
            { label: "Avg Response Time", value: `${data.kpis.avgResponseTime}s`, change: "-0.4s", up: false },
            { label: "CSAT Score", value: String(data.kpis.csat), change: "+0.2", up: true },
          ]);
        }
        if (data.trends) {
          setTrendData(data.trends.map((t: { date: string; conversations: number; resolved: number; latency: number }) => ({
            day: t.date,
            conversations: t.conversations,
            resolved: t.resolved,
            latency: t.latency,
          })));
        }
        if (data.flagged) {
          setFlaggedConversations(data.flagged.map((f: { id: string; issue: string; severity: "High" | "Medium" | "Low"; status: "Open" | "In Progress" | "Resolved"; assignee: string }) => ({
            id: f.id,
            issue: f.issue,
            severity: f.severity,
            status: f.status,
            assignee: f.assignee,
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Insights 2.0</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
                Analytics & <span className="text-gradient">Optimization</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                Analyze, monitor, experiment, and observe every aspect of your AI agents.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-white/10">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" className="border-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {kpiData.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              custom={i}
            >
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-6">
                  <div className="text-sm text-muted-foreground mb-2">{kpi.label}</div>
                  <div className="text-3xl font-semibold mb-2">{kpi.value}</div>
                  <div className={`flex items-center gap-1 text-sm ${kpi.up ? "text-green-400" : "text-[#c4a574]"}`}>
                    {kpi.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {kpi.change}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="explorer" className="space-y-6">
          <TabsList className="bg-[#141414] border border-white/5 p-1">
            <TabsTrigger value="explorer" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
              <Search className="h-4 w-4 mr-2" />
              Explorer
            </TabsTrigger>
            <TabsTrigger value="monitors" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Monitors
            </TabsTrigger>
            <TabsTrigger value="experiments" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
              <FlaskConical className="h-4 w-4 mr-2" />
              Experiments
            </TabsTrigger>
            <TabsTrigger value="observability" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
              <Activity className="h-4 w-4 mr-2" />
              Observability
            </TabsTrigger>
          </TabsList>

          {/* Explorer Tab */}
          <TabsContent value="explorer" className="space-y-6">
            <Card className="bg-[#141414] border-white/5">
              <CardContent className="p-6">
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ask anything about your conversations..."
                    className="pl-10 bg-[#0a0a0a] border-white/10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded bg-[#c4a574]/20 flex items-center justify-center">
                        <Search className="h-3 w-3 text-[#c4a574]" />
                      </div>
                      <span className="text-sm font-medium">Deep Research Analysis</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Based on analysis of 2.4M conversations this week, I found several key patterns:
                    </p>
                    <div className="space-y-3">
                      {[
                        "Return-related conversations spiked 34% on Friday, correlating with the promotional email sent Thursday evening.",
                        "Customers who interact with the agent for &gt;3 minutes have 2.3x higher CSAT scores when proactive follow-up is offered.",
                        "The ' expedited shipping' skill resolves 89% of delivery complaints without escalation.",
                        "Negative sentiment is 4x more likely when wait time exceeds 30 seconds before agent response.",
                      ].map((insight, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#c4a574]" />
                          <span className="text-sm text-foreground/80">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitors Tab */}
          <TabsContent value="monitors" className="space-y-6">
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-lg">Flagged Conversations</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5 text-left text-sm text-muted-foreground">
                        <th className="pb-3 font-medium">ID</th>
                        <th className="pb-3 font-medium">Issue</th>
                        <th className="pb-3 font-medium">Severity</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Assignee</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {flaggedConversations.map((conv) => (
                        <tr key={conv.id} className="border-b border-white/5 last:border-0">
                          <td className="py-4 font-mono text-muted-foreground">{conv.id}</td>
                          <td className="py-4">{conv.issue}</td>
                          <td className="py-4">
                            <Badge variant="outline" className={severityColor(conv.severity)}>
                              {conv.severity}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              {statusIcon(conv.status)}
                              <span>{conv.status}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            {conv.assignee === "Unassigned" ? (
                              <span className="text-muted-foreground">{conv.assignee}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-[#c4a574]/20 text-[#c4a574]">
                                    {conv.assignee.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{conv.assignee}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Experiments Tab */}
          <TabsContent value="experiments" className="space-y-6">
            <div className="grid gap-6">
              {experiments.map((exp, i) => (
                <Card key={exp.name} className="bg-[#141414] border-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-semibold text-lg">{exp.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Confidence: {exp.confidence}% {exp.winner && "· Winner determined"}
                        </p>
                      </div>
                      {exp.winner ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Winner: Variant {exp.winner}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                          Inconclusive
                        </Badge>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Variant A: {exp.variantA.label}</span>
                          <span className="text-sm font-semibold">{exp.variantA.rate}%</span>
                        </div>
                        <Progress value={exp.variantA.rate} className="h-2 bg-white/5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Variant B: {exp.variantB.label}</span>
                          <span className="text-sm font-semibold">{exp.variantB.rate}%</span>
                        </div>
                        <Progress value={exp.variantB.rate} className="h-2 bg-white/5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Observability Tab */}
          <TabsContent value="observability" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-[#141414] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Conversation Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c4a574" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#c4a574" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" stroke="#a89f94" fontSize={12} />
                      <YAxis stroke="#a89f94" fontSize={12} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      />
                      <Area type="monotone" dataKey="conversations" stroke="#c4a574" fillOpacity={1} fill="url(#colorConv)" />
                      <Area type="monotone" dataKey="resolved" stroke="#8b7355" fillOpacity={0} fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-[#141414] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Response Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day" stroke="#a89f94" fontSize={12} />
                      <YAxis stroke="#a89f94" fontSize={12} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      />
                      <Line type="monotone" dataKey="latency" stroke="#c4a574" strokeWidth={2} dot={{ fill: "#c4a574" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-[#141414] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Tool Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={toolCallData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="#a89f94" fontSize={12} />
                      <YAxis dataKey="name" type="category" stroke="#a89f94" fontSize={12} width={100} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      />
                      <Bar dataKey="calls" fill="#c4a574" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-[#141414] border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg">Sentiment Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {sentimentData.map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-muted-foreground">{s.name} {s.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
