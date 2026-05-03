"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Link2,
  AlertTriangle,
  Plus,
  ExternalLink,
  RefreshCw,
  FileText,
  Video,
  Loader2,
  ChevronDown,
  Zap,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KnowledgeSource {
  id: string;
  name: string;
  type: "help-center" | "faq" | "policy" | "integration" | "media";
  status: "active" | "syncing" | "error" | "draft";
  entries: number;
  lastSync: string;
  url?: string;
  gaps?: string[];
}

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  status: "open" | "resolved";
  suggestedAnswer?: string;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "help-center": return BookOpen;
    case "faq": return FileText;
    case "policy": return FileText;
    case "integration": return Link2;
    case "media": return Video;
    default: return BookOpen;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "syncing": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "error": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "draft": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    default: return "bg-gray-500/20 text-gray-400";
  }
};

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sources");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sourcesRes, gapsRes] = await Promise.all([
          fetch("/api/knowledge/sources"),
          fetch("/api/knowledge/gaps"),
        ]);
        const sourcesData = await sourcesRes.json();
        const gapsData = await gapsRes.json();
        setSources(
          (sourcesData.sources || []).map((s: Record<string, unknown>) => ({
            ...s,
            lastSync: (s.last_sync as string) ?? (s.lastSync as string) ?? "",
          })) as KnowledgeSource[]
        );
        setKnowledgeGaps(
          (gapsData.gaps || []).map((g: Record<string, unknown>) => ({
            ...g,
            suggestedAnswer: (g.suggested_answer as string) ?? (g.suggestedAnswer as string) ?? undefined,
          })) as KnowledgeGap[]
        );
      } catch (e) {
        console.error("Failed to fetch knowledge data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredSources = sources.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await fetch(`/api/knowledge/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", lastSync: "Just now" }),
      });
      setSources((prev) => prev.map((s) => s.id === id ? { ...s, status: "active" as const, lastSync: "Just now" } : s));
    } catch (e) {
      console.error("Failed to sync source", e);
    } finally {
      setSyncingId(null);
    }
  };

  const openGaps = knowledgeGaps.filter((g) => g.status === "open");

  if (loading) {
    return (
      <main className="relative min-h-screen pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-sierra" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#c4a574]" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Knowledge Base</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Your agent's <span className="text-gradient">source of truth</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Connect Help Centers, FAQs, policies, and external systems. Detect knowledge gaps 
            and keep answers accurate with real-time grounding and traceability.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-5">
              <div className="text-3xl font-semibold">{sources.length}</div>
              <div className="text-xs text-muted-foreground">Connected Sources</div>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-5">
              <div className="text-3xl font-semibold">{sources.reduce((s, c) => s + c.entries, 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Entries</div>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-5">
              <div className="text-3xl font-semibold text-yellow-400">{openGaps.length}</div>
              <div className="text-xs text-muted-foreground">Knowledge Gaps</div>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-5">
              <div className="text-3xl font-semibold text-green-400">
                {sources.filter((s) => s.status === "active").length}
              </div>
              <div className="text-xs text-muted-foreground">Active Sources</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#141414] border border-white/5">
              <TabsTrigger value="sources" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                <BookOpen className="h-4 w-4 mr-2" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="gaps" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Knowledge Gaps ({openGaps.length})
              </TabsTrigger>
              <TabsTrigger value="grounding" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <Zap className="h-4 w-4 mr-2" />
                Real-Time Grounding
              </TabsTrigger>
            </TabsList>

            {/* Sources Tab */}
            <TabsContent value="sources" className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search knowledge sources..."
                    className="pl-10 bg-[#141414] border-white/10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Source
                </Button>
              </div>

              <div className="grid gap-4">
                {filteredSources.map((source) => {
                  const Icon = getTypeIcon(source.type);
                  const isExpanded = expandedSource === source.id;
                  return (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="bg-[#141414] border-white/5 hover:border-white/10 transition-colors">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-[#0a0a0a] border border-white/5 flex items-center justify-center">
                                <Icon className="h-5 w-5 text-[#c4a574]" />
                              </div>
                              <div>
                                <div className="font-medium">{source.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {source.entries.toLocaleString()} entries &middot; {source.lastSync}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(source.status)}>
                                {source.status === "active" ? "Active" : source.status === "syncing" ? "Syncing" : source.status === "error" ? "Error" : "Draft"}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => setExpandedSource(isExpanded ? null : source.id)}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </Button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 pt-4 border-t border-white/5"
                              >
                                {source.gaps && source.gaps.length > 0 && (
                                  <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <div className="text-sm font-medium text-red-300 mb-1">Detected Gaps</div>
                                    {source.gaps.map((gap, i) => (
                                      <div key={i} className="text-sm text-red-300/70 flex items-center gap-2">
                                        <AlertTriangle className="h-3 w-3" />
                                        {gap}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10"
                                    disabled={syncingId === source.id}
                                    onClick={() => handleSync(source.id)}
                                  >
                                    {syncingId === source.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    ) : (
                                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Sync
                                  </Button>
                                  {source.url && (
                                    <Button variant="outline" size="sm" className="border-white/10">
                                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                      View Source
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Remove
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Gaps Tab */}
            <TabsContent value="gaps" className="mt-6">
              <div className="grid gap-4">
                {knowledgeGaps.map((gap) => (
                  <motion.div
                    key={gap.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`bg-[#141414] border-white/5 ${gap.status === "open" ? "border-yellow-500/20" : "border-green-500/20"}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={gap.status === "open" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}>
                                {gap.status === "open" ? "Open" : "Resolved"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Asked {gap.frequency}x this week</span>
                            </div>
                            <div className="font-medium mb-1">{gap.question}</div>
                            {gap.suggestedAnswer && (
                              <div className="text-sm text-muted-foreground bg-[#0a0a0a] p-3 rounded-lg border border-white/5 mt-2">
                                <span className="text-[#c4a574] font-medium">Suggested answer:</span> {gap.suggestedAnswer}
                              </div>
                            )}
                          </div>
                          {gap.status === "open" && (
                            <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] ml-4 shrink-0">
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Add to KB
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Real-Time Grounding Tab */}
            <TabsContent value="grounding" className="mt-6">
              <Card className="bg-[#141414] border-white/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#c4a574]" />
                    Response Traceability
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      customer: "What is your return policy?",
                      answer: "You can return any item within 30 days for a full refund. Defective items get free replacement.",
                      sources: ["Return & Refund Policy", "Help Center Articles"],
                      confidence: 98,
                    },
                    {
                      customer: "How long does shipping take?",
                      answer: "Standard shipping takes 3-5 business days. Express shipping delivers in 1-2 days for $9.99.",
                      sources: ["Shipping Guidelines"],
                      confidence: 87,
                      note: "Source has gaps — missing international info",
                    },
                    {
                      customer: "Do you accept PayPal?",
                      answer: "Yes, we accept Visa, Mastercard, Amex, PayPal, Apple Pay, and Google Pay.",
                      sources: ["Payment FAQ"],
                      confidence: 95,
                    },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-7 w-7 rounded-full bg-[#c4a574]/20 flex items-center justify-center shrink-0">
                          <span className="text-xs text-[#c4a574]">Q</span>
                        </div>
                        <div className="text-sm">{item.customer}</div>
                      </div>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs text-blue-400">A</span>
                        </div>
                        <div className="text-sm">{item.answer}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-10">
                        <span className="text-xs text-muted-foreground">Grounded in:</span>
                        {item.sources.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] h-5 border-[#c4a574]/30 text-[#c4a574]">
                            <BookOpen className="h-3 w-3 mr-1" />
                            {s}
                          </Badge>
                        ))}
                        <Badge className={`text-[10px] h-5 ml-auto ${item.confidence >= 90 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {item.confidence}% confidence
                        </Badge>
                      </div>
                      {item.note && (
                        <div className="mt-2 ml-10 text-xs text-yellow-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {item.note}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </main>
  );
}
