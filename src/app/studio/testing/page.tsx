"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Beaker,
  GitBranch,
  Mic,
  Volume2,
  Play,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Clock,
  ChevronDown,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RegressionTest {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "running" | "pending";
  lastRun: string;
  duration: string;
  category: "behavior" | "policy" | "tone" | "technical";
}

interface VoiceSim {
  id: string;
  name: string;
  noise: string;
  speaker: string;
  transcription: string;
  confidence: number;
  accuracy: number;
  status: "pass" | "fail";
}

interface RunHistoryItem {
  time: string;
  pass: number;
  fail: number;
  total: number;
}

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case "behavior": return "bg-purple-500/20 text-purple-400";
    case "policy": return "bg-blue-500/20 text-blue-400";
    case "tone": return "bg-pink-500/20 text-pink-400";
    case "technical": return "bg-orange-500/20 text-orange-400";
    default: return "bg-gray-500/20 text-gray-400";
  }
};

export default function TestingPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("regression");
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [regressionTests, setRegressionTests] = useState<RegressionTest[]>([]);
  const [voiceSims, setVoiceSims] = useState<VoiceSim[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [regRes, voiceRes, historyRes] = await Promise.all([
          fetch("/api/tests/regression"),
          fetch("/api/tests/voice"),
          fetch("/api/tests/history"),
        ]);
        const regData = await regRes.json();
        const voiceData = await voiceRes.json();
        const historyData = await historyRes.json();
        setRegressionTests(
          (regData.tests || []).map((t: Record<string, unknown>) => ({
            ...t,
            lastRun: (t.last_run as string) ?? (t.lastRun as string) ?? "",
          })) as RegressionTest[]
        );
        setVoiceSims(
          (voiceData.sims || []).map((s: Record<string, unknown>) => ({
            ...s,
            noise: (s.noise_level as string) ?? (s.noise as string) ?? "",
            speaker: (s.speaker_type as string) ?? (s.speaker as string) ?? "",
          })) as VoiceSim[]
        );
        setRunHistory((historyData.runs || []) as RunHistoryItem[]);
      } catch (e) {
        console.error("Failed to fetch testing data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);

    try {
      await fetch("/api/tests/regression/run", { method: "POST" });
    } catch (e) {
      // endpoint may not exist; continue with local simulation
    }

    for (let i = 0; i < regressionTests.length; i++) {
      setProgress(Math.round(((i + 1) / regressionTests.length) * 100));
      await new Promise((r) => setTimeout(r, 300));
    }

    // refresh data
    try {
      const [regRes, historyRes] = await Promise.all([
        fetch("/api/tests/regression"),
        fetch("/api/tests/history"),
      ]);
      const regData = await regRes.json();
      const historyData = await historyRes.json();
      setRegressionTests(
        (regData.tests || []).map((t: Record<string, unknown>) => ({
          ...t,
          lastRun: (t.last_run as string) ?? (t.lastRun as string) ?? "",
        })) as RegressionTest[]
      );
      setRunHistory((historyData.runs || []) as RunHistoryItem[]);
    } catch (e) {
      console.error("Failed to refresh testing data", e);
    }

    setIsRunning(false);
  };

  const passCount = regressionTests.filter((t) => t.status === "pass").length;
  const failCount = regressionTests.filter((t) => t.status === "fail").length;

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
            <Beaker className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Test Suite</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Prevent regressions <span className="text-gradient">before release</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Run regression test suites, simulate voice conversations with noise and accent variation, 
            and validate every behavior before deploying to production.
          </p>
        </motion.div>

        {/* Run Control */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center px-4">
                      <div className="text-2xl font-semibold text-green-400">{passCount}</div>
                      <div className="text-xs text-muted-foreground">Passing</div>
                    </div>
                    <div className="text-center px-4 border-l border-white/5">
                      <div className="text-2xl font-semibold text-red-400">{failCount}</div>
                      <div className="text-xs text-muted-foreground">Failing</div>
                    </div>
                  </div>
                  <div className="hidden md:block w-px h-12 bg-white/5" />
                  <div>
                    <div className="text-sm font-medium">{regressionTests.length} tests total</div>
                    <div className="text-xs text-muted-foreground">Last run: 2 min ago</div>
                  </div>
                </div>
                <Button
                  onClick={runAllTests}
                  disabled={isRunning}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isRunning ? "Running Suite..." : "Run All Tests"}
                </Button>
              </div>

              {isRunning && (
                <div className="mt-4">
                  <Progress value={progress} className="h-2 bg-white/5" />
                  <div className="text-xs text-muted-foreground mt-2 text-right">{progress}%</div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#141414] border border-white/5">
              <TabsTrigger value="regression" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                <GitBranch className="h-4 w-4 mr-2" />
                Regression Tests
              </TabsTrigger>
              <TabsTrigger value="voice" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                <Mic className="h-4 w-4 mr-2" />
                Voice Sims
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                <Clock className="h-4 w-4 mr-2" />
                Run History
              </TabsTrigger>
            </TabsList>

            {/* Regression Tests */}
            <TabsContent value="regression" className="mt-6">
              <div className="grid gap-3">
                {regressionTests.map((test) => (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`bg-[#141414] border-white/5 ${test.status === "fail" ? "border-red-500/20" : test.status === "pass" ? "border-green-500/20" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              test.status === "pass" ? "bg-green-500/10" : test.status === "fail" ? "bg-red-500/10" : "bg-blue-500/10"
                            }`}>
                              {test.status === "pass" ? <Check className="h-4 w-4 text-green-400" /> :
                               test.status === "fail" ? <X className="h-4 w-4 text-red-400" /> :
                               <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{test.name}</div>
                              <div className="text-xs text-muted-foreground">{test.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getCategoryColor(test.category)}>
                              {test.category}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}>
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedTest === test.id ? "rotate-180" : ""}`} />
                            </Button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedTest === test.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t border-white/5"
                            >
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Last Run</div>
                                  <div>{test.lastRun}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Duration</div>
                                  <div>{test.duration}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                                  <Badge className={test.status === "pass" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                    {test.status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                              {test.status === "fail" && (
                                <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-sm text-red-300">
                                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                                  Test failed: Expected behavior not observed. Review agent configuration.
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Voice Sims */}
            <TabsContent value="voice" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voiceSims.map((sim) => (
                  <motion.div
                    key={sim.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`bg-[#141414] border-white/5 ${sim.status === "fail" ? "border-red-500/20" : "border-green-500/20"}`}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="font-medium">{sim.name}</div>
                          <Badge className={sim.status === "pass" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {sim.status === "pass" ? "PASS" : "FAIL"}
                          </Badge>
                        </div>

                        <div className="p-3 rounded-lg bg-[#0a0a0a] border border-white/5 mb-4">
                          <div className="text-xs text-muted-foreground mb-1">Transcription</div>
                          <div className="text-sm font-mono">"{sim.transcription}"</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Noise Level</div>
                            <div className="flex items-center gap-1">
                              <Volume2 className="h-3.5 w-3.5" />
                              {sim.noise}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Speaker</div>
                            <div className="flex items-center gap-1">
                              <Headphones className="h-3.5 w-3.5" />
                              {sim.speaker}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                            <div className={`font-medium ${sim.confidence >= 85 ? "text-green-400" : sim.confidence >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                              {sim.confidence}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Accuracy</div>
                            <div className={`font-medium ${sim.accuracy >= 95 ? "text-green-400" : sim.accuracy >= 85 ? "text-yellow-400" : "text-red-400"}`}>
                              {sim.accuracy}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Run History */}
            <TabsContent value="history" className="mt-6">
              <div className="space-y-3">
                {runHistory.map((run, i) => (
                  <Card key={i} className="bg-[#141414] border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Test Suite Run</div>
                            <div className="text-xs text-muted-foreground">{run.time}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-green-400">{run.pass}</span> pass /{" "}
                              <span className="text-red-400">{run.fail}</span> fail
                            </div>
                            <div className="text-xs text-muted-foreground">{run.total} tests</div>
                          </div>
                          <Progress value={(run.pass / run.total) * 100} className="w-24 h-2 bg-white/5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </main>
  );
}
