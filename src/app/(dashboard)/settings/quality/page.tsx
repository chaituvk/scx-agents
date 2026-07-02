"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Edit3,
  Check,
  X,
  RefreshCw,
  Star,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface QualityMessage {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  verdict: "pending" | "approved" | "flagged" | "corrected";
  rating: number | null;
  comment: string | null;
  corrected_content: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const VERDICT_CONFIG = {
  pending: { label: "Pending review", color: "text-gray-400 bg-gray-400/10", icon: AlertCircle },
  approved: { label: "Approved", color: "text-green-400 bg-green-400/10", icon: ThumbsUp },
  flagged: { label: "Flagged", color: "text-red-400 bg-red-400/10", icon: ThumbsDown },
  corrected: { label: "Corrected", color: "text-orange-400 bg-orange-400/10", icon: Edit3 },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-colors"
        >
          <Star
            className={`h-5 w-5 ${
              n <= (hover || value) ? "text-[#c4a574] fill-[#c4a574]" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewPanelProps {
  msg: QualityMessage;
  onReviewed: (updated: QualityMessage) => void;
}

function ReviewPanel({ msg, onReviewed }: ReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<"approved" | "flagged" | "corrected">("approved");
  const [rating, setRating] = useState(msg.rating ?? 0);
  const [comment, setComment] = useState(msg.comment ?? "");
  const [corrected, setCorrected] = useState(msg.corrected_content ?? msg.content);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: msg.id,
          verdict,
          rating: rating || null,
          comment: comment || null,
          corrected_content: verdict === "corrected" ? corrected : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onReviewed({ ...msg, verdict, rating: rating || null, comment: comment || null, corrected_content: verdict === "corrected" ? corrected : null, reviewed_at: data.review.reviewed_at });
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const cfg = VERDICT_CONFIG[msg.verdict];
  const Icon = cfg.icon;

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 transition-transform ${open ? "rotate-90" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.color}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            {msg.rating && (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: msg.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-[#c4a574] fill-[#c4a574]" />
                ))}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
          </div>
          <p className="text-sm text-foreground line-clamp-2">{msg.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{msg.id.slice(0, 8)}</span>
      </button>

      {open && (
        <div className="px-9 pb-5 space-y-4">
          {/* Original + corrected */}
          <div className="bg-[#0a0a0a] rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">AI response</p>
            <p className="text-sm text-foreground">{msg.content}</p>
          </div>

          {msg.verdict !== "pending" && (
            <div className="text-xs text-muted-foreground">
              Reviewed {msg.reviewed_at ? formatDate(msg.reviewed_at) : "—"}
              {msg.comment && <span className="ml-3">"{msg.comment}"</span>}
              {msg.corrected_content && msg.corrected_content !== msg.content && (
                <div className="mt-2 bg-green-500/5 border border-green-500/20 rounded-lg p-2">
                  <p className="text-green-400 font-medium mb-1">Corrected version:</p>
                  <p className="text-foreground">{msg.corrected_content}</p>
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              {(["approved", "flagged", "corrected"] as const).map((v) => {
                const c = VERDICT_CONFIG[v];
                const Vi = c.icon;
                return (
                  <button
                    key={v}
                    onClick={() => setVerdict(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      verdict === v
                        ? `${c.color} border-current`
                        : "border-white/10 text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    <Vi className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Quality rating (optional)</p>
              <StarRating value={rating} onChange={setRating} />
            </div>

            {verdict === "corrected" && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Corrected response</p>
                <Textarea
                  value={corrected}
                  onChange={(e) => setCorrected(e.target.value)}
                  rows={4}
                  className="bg-[#0a0a0a] text-sm resize-none"
                />
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Comment (optional)</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Why was this flagged or corrected?"
                rows={2}
                className="bg-[#0a0a0a] text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={submit}
                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
              >
                {saving ? "Saving…" : "Submit review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type VerdictFilter = "all" | "pending" | "approved" | "flagged" | "corrected";
const DAYS_OPTIONS = [1, 7, 30];

export default function QualityPage() {
  const [messages, setMessages] = useState<QualityMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("pending");
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), limit: "50" });
      if (verdictFilter !== "all") params.set("verdict", verdictFilter);
      const res = await fetch(`/api/quality?${params}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [days, verdictFilter]);

  useEffect(() => { load(); }, [load]);

  const verdictCounts = messages.reduce<Record<string, number>>((acc, m) => {
    acc[m.verdict] = (acc[m.verdict] ?? 0) + 1;
    return acc;
  }, {});

  const avgRating = (() => {
    const rated = messages.filter((m) => m.rating);
    if (!rated.length) return null;
    return (rated.reduce((s, m) => s + (m.rating ?? 0), 0) / rated.length).toFixed(1);
  })();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Quality Review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and rate AI responses to improve quality over time.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total responses</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">{verdictCounts.approved ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-400">{verdictCounts.flagged ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Flagged</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-[#c4a574]">{avgRating ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg quality score</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1">
          {(["all", "pending", "approved", "flagged", "corrected"] as VerdictFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setVerdictFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                verdictFilter === v
                  ? "bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {v}
              {v !== "all" && verdictCounts[v] !== undefined && (
                <span className="ml-1 text-[10px] opacity-70">({verdictCounts[v]})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[#c4a574]/10 text-[#c4a574]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <Card className="bg-[#0a0a0a] border-white/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {verdictFilter === "pending"
                  ? "All AI responses have been reviewed."
                  : "No messages match the selected filter."}
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <ReviewPanel
                key={m.id}
                msg={m}
                onReviewed={(updated) => setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
