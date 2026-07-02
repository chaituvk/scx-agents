"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  Zap,
  RefreshCw,
  Download,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DigestKpis {
  total_conversations: number;
  resolved: number;
  escalated: number;
  positive_sentiment: number;
  negative_sentiment: number;
  avg_handle_mins: number;
  resolution_rate: number;
  avg_csat: number | null;
  csat_count: number;
  total_tokens: number;
  total_cost_usd: number;
  open_knowledge_gaps: number;
}

interface CsatSummary {
  avg_score: number;
  count: number;
  distribution: Record<string, number>;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}

type Period = "daily" | "weekly";

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-blue-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="bg-[#0a0a0a] border-white/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1 opacity-70">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StarBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-8 shrink-0">{label}★</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-[#c4a574] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">{count}</span>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [kpis, setKpis] = useState<DigestKpis | null>(null);
  const [csat, setCsat] = useState<CsatSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; emails?: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [digestRes, csatRes] = await Promise.all([
        fetch(`/api/reports/digest?period=${period}`),
        fetch(`/api/csat?days=${period === "weekly" ? 7 : 1}`),
      ]);
      const [digestData, csatData] = await Promise.all([digestRes.json(), csatRes.json()]);
      setKpis(digestData.kpis ?? null);
      setCsat(csatData.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  async function sendDigest() {
    setSending(true);
    setSendResult(null);
    const emailList = recipients.split(",").map((e) => e.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/reports/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, recipients: emailList }),
      });
      const data = await res.json();
      setSendResult({ ok: data.ok, emails: data.emails_sent });
    } catch {
      setSendResult({ ok: false });
    } finally {
      setSending(false);
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const distributionTotal = csat ? Object.values(csat.distribution).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#c4a574]" />
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance digest and CSAT summary. Send on-demand or schedule via GitHub Actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(["daily", "weekly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  period === p ? "bg-[#c4a574] text-[#0a0a0a]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : kpis ? (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <KpiCard icon={MessageSquare} label="Conversations" value={kpis.total_conversations.toLocaleString()} color="text-blue-400" />
            <KpiCard
              icon={CheckCircle2}
              label="Resolution rate"
              value={pct(kpis.resolution_rate)}
              sub={`${kpis.resolved} resolved`}
              color="text-green-400"
            />
            <KpiCard
              icon={Star}
              label="CSAT score"
              value={kpis.avg_csat ? `${kpis.avg_csat.toFixed(1)} / 5` : "No data"}
              sub={kpis.csat_count > 0 ? `${kpis.csat_count} ratings` : undefined}
              color="text-[#c4a574]"
            />
            <KpiCard
              icon={Clock}
              label="Avg handle time"
              value={`${kpis.avg_handle_mins.toFixed(0)}m`}
              color="text-purple-400"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Escalations"
              value={kpis.escalated}
              sub={`${kpis.total_conversations > 0 ? ((kpis.escalated / kpis.total_conversations) * 100).toFixed(1) : 0}% of total`}
              color="text-orange-400"
            />
            <KpiCard
              icon={Zap}
              label="AI cost"
              value={`$${kpis.total_cost_usd.toFixed(2)}`}
              sub={`${(kpis.total_tokens / 1000).toFixed(0)}k tokens`}
              color="text-cyan-400"
            />
          </div>

          {/* CSAT and Sentiment row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* CSAT distribution */}
            <Card className="bg-[#0a0a0a] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#c4a574]" />
                  CSAT Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {csat && distributionTotal > 0 ? (
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((s) => (
                      <StarBar
                        key={s}
                        label={String(s)}
                        count={csat.distribution[s] ?? 0}
                        total={distributionTotal}
                      />
                    ))}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">NPS</span>
                      <span className={`font-bold ${csat.nps >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {csat.nps > 0 ? "+" : ""}{csat.nps}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No CSAT data for this period.</p>
                )}
              </CardContent>
            </Card>

            {/* Sentiment */}
            <Card className="bg-[#0a0a0a] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Positive", count: kpis.positive_sentiment, color: "bg-green-500" },
                    {
                      label: "Neutral",
                      count: kpis.total_conversations - kpis.positive_sentiment - kpis.negative_sentiment,
                      color: "bg-gray-500",
                    },
                    { label: "Negative", count: kpis.negative_sentiment, color: "bg-red-500" },
                  ].map(({ label, count, color }) => {
                    const pctVal = kpis.total_conversations > 0 ? (count / kpis.total_conversations) * 100 : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
                {kpis.open_knowledge_gaps > 0 && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      <span className="text-yellow-400 font-medium">{kpis.open_knowledge_gaps}</span> open knowledge gaps — customers asked questions your AI couldn't answer.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No report data available.</p>
          </CardContent>
        </Card>
      )}

      {/* Send digest */}
      <Card className="bg-[#0a0a0a] border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#c4a574]" />
            Send Digest Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Send this {period} digest to email addresses. Separate multiple addresses with commas.
            Or schedule it automatically via the GitHub Actions workflow in{" "}
            <code className="text-[#c4a574] text-[10px]">.github/workflows/digest.yml</code>.
          </p>
          <div className="flex gap-3">
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="team@company.com, ceo@company.com"
              className="bg-[#141414]"
            />
            <Button
              onClick={sendDigest}
              disabled={sending || !recipients.trim()}
              className="shrink-0 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
            >
              {sending ? (
                <>Sending…</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send now
                </>
              )}
            </Button>
          </div>
          {sendResult && (
            <div className={`flex items-center gap-2 mt-3 text-sm ${sendResult.ok ? "text-green-400" : "text-red-400"}`}>
              {sendResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {sendResult.ok
                ? sendResult.emails?.length
                  ? `Sent to ${sendResult.emails.join(", ")}`
                  : "Generated (no recipients configured — check email adapter)"
                : "Failed to send — check email adapter configuration"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
