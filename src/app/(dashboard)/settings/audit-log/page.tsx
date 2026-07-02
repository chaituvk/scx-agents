"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScrollText,
  Search,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  Link2,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AuditEvent {
  id: string;
  conversation_id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  conversation_started: "text-green-400 bg-green-400/10",
  conversation_closed: "text-gray-400 bg-gray-400/10",
  message_sent: "text-blue-400 bg-blue-400/10",
  escalation_triggered: "text-orange-400 bg-orange-400/10",
  escalation_resolved: "text-green-400 bg-green-400/10",
  playbook_completed: "text-purple-400 bg-purple-400/10",
  handover_accepted: "text-cyan-400 bg-cyan-400/10",
  intent_detected: "text-yellow-400 bg-yellow-400/10",
  sentiment_detected: "text-pink-400 bg-pink-400/10",
};

const ALL_EVENT_TYPES = [
  "conversation_started",
  "conversation_closed",
  "message_sent",
  "escalation_triggered",
  "escalation_resolved",
  "playbook_completed",
  "handover_accepted",
  "intent_detected",
  "sentiment_detected",
];

function formatTs(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventBadge({ type }: { type: string }) {
  const color = EVENT_TYPE_COLORS[type] ?? "text-gray-400 bg-gray-400/10";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const payloadEntries = Object.entries(event.payload ?? {}).filter(([k]) => !["event_hash", "prev_hash"].includes(k));

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <EventBadge type={event.type} />
          <span className="text-xs text-muted-foreground shrink-0">{formatTs(event.ts)}</span>
          {event.conversation_id && (
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              conv:{event.conversation_id.slice(0, 8)}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{event.id.slice(0, 8)}</span>
      </button>
      {expanded && payloadEntries.length > 0 && (
        <div className="px-9 pb-3">
          <div className="bg-[#0a0a0a] rounded-lg p-3 font-mono text-xs text-muted-foreground space-y-1">
            {payloadEntries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-[#c4a574] shrink-0">{k}:</span>
                <span className="break-all">{JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
          {event.conversation_id && (
            <a
              href={`/inbox?conversation=${event.conversation_id}`}
              className="inline-flex items-center gap-1 mt-2 text-[10px] text-[#c4a574] hover:text-[#d4c4b0]"
            >
              <Link2 className="h-3 w-3" />
              View conversation
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const DAYS_OPTIONS = [1, 7, 30, 90];

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [days, setDays] = useState(7);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(currentOffset),
        days: String(days),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      params.set("since", since);

      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
      if (reset) setOffset(0);
    } finally {
      setLoading(false);
    }
  }, [days, typeFilter, offset]);

  useEffect(() => { load(true); }, [days, typeFilter]);

  const filtered = search
    ? events.filter((e) =>
        e.type.includes(search.toLowerCase()) ||
        e.conversation_id?.includes(search) ||
        JSON.stringify(e.payload).toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-[#c4a574]" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tamper-evident event trail for all AI and agent activity. Hash-chained for integrity.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} className="text-muted-foreground">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Integrity notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#c4a574]/5 border border-[#c4a574]/20 mb-6">
        <Info className="h-4 w-4 text-[#c4a574] shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Events are SHA-256 hash-chained — each event includes the hash of the prior event,
          making any tampering detectable. The chain is automatically verified per conversation.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="pl-9 bg-[#0a0a0a]"
          />
        </div>

        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-[#0a0a0a] border border-white/10 rounded-md px-2 py-1.5 text-foreground"
          >
            <option value="all">All events</option>
            {ALL_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span>{total.toLocaleString()} events in period</span>
        {search && <span>· {filtered.length} matching "{search}"</span>}
      </div>

      {/* Events list */}
      <Card className="bg-[#0a0a0a] border-white/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No events found for the selected filters.</p>
            </div>
          ) : (
            <div>
              {filtered.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(offset + 1, total)}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => { setOffset(Math.max(0, offset - LIMIT)); load(); }}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={offset + LIMIT >= total || loading}
              onClick={() => { setOffset(offset + LIMIT); load(); }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
