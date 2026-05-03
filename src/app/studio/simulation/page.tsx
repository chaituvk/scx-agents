"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  FlaskConical,
  Check,
  X,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Bot,
  User,
  TrendingUp,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SimConversation {
  id: string;
  scenario: string;
  messages: Array<{
    role: "user" | "agent";
    text: string;
    timestamp: string;
    groundings?: string[];
  }>;
  outcome: "success" | "failure" | "partial";
  metrics: {
    resolution: number;
    empathy: number;
    compliance: number;
    accuracy: number;
  };
  issues: string[];
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: string;
}

const generateSimConversation = (scenarioId: string): SimConversation => {
  const convos: Record<string, SimConversation> = {
    "return-window": {
      id: "sim-1",
      scenario: "Return Outside Window",
      messages: [
        { role: "user", text: "Hi, I need to return these headphones. They broke after a few weeks.", timestamp: "10:01" },
        { role: "agent", text: "I'm sorry to hear that. Can you provide your order number?", timestamp: "10:02" },
        { role: "user", text: "It's #45678", timestamp: "10:03" },
        { role: "agent", text: "I see this order was placed 45 days ago, which is outside our standard 30-day return window. Let me connect you with a manager who can review your case.", timestamp: "10:04", groundings: ["Return policy: 30-day window", "Guardrail: Escalate exceptions to manager"] },
      ],
      outcome: "success",
      metrics: { resolution: 95, empathy: 88, compliance: 100, accuracy: 97 },
      issues: [],
    },
    "defective-happy": {
      id: "sim-2",
      scenario: "Defective Product - Happy Path",
      messages: [
        { role: "user", text: "My blender arrived with a cracked pitcher.", timestamp: "11:01" },
        { role: "agent", text: "I apologize for the inconvenience. I can ship a replacement pitcher right away at no charge.", timestamp: "11:02", groundings: ["Policy: Defective items get free replacement"] },
        { role: "user", text: "That would be great, thanks!", timestamp: "11:03" },
        { role: "agent", text: "Done! You'll receive tracking within 24 hours. Is there anything else?", timestamp: "11:04" },
      ],
      outcome: "success",
      metrics: { resolution: 100, empathy: 92, compliance: 100, accuracy: 100 },
      issues: [],
    },
    "angry-refund": {
      id: "sim-3",
      scenario: "Angry Customer - Large Refund",
      messages: [
        { role: "user", text: "This is the WORST service ever. I want my $800 back RIGHT NOW.", timestamp: "14:01" },
        { role: "agent", text: "I completely understand your frustration, and I'm here to help resolve this for you. Let me look up your order.", timestamp: "14:02", groundings: ["Tone: Empathetic, never defensive"] },
        { role: "user", text: "Order #99999. Just process the refund already.", timestamp: "14:03" },
        { role: "agent", text: "I found your order. For refunds over $500, I need to get approval from my supervisor. This is standard to ensure we handle your case correctly. Can I transfer you?", timestamp: "14:04", groundings: ["Guardrail: Refunds >$500 require manager approval"] },
      ],
      outcome: "partial",
      metrics: { resolution: 65, empathy: 90, compliance: 100, accuracy: 85 },
      issues: ["Could have apologized more sincerely", "Should offer expedited review option"],
    },
    "wrong-item": {
      id: "sim-4",
      scenario: "Wrong Item Shipped",
      messages: [
        { role: "user", text: "I ordered size 9 but got size 11.", timestamp: "09:01" },
        { role: "agent", text: "I apologize for the mix-up. I'll ship the correct size 9 today with expedited delivery, and arrange for pickup of the size 11 at your convenience.", timestamp: "09:02", groundings: ["Policy: Wrong items ship immediately + arrange pickup"] },
        { role: "user", text: "Perfect, thank you!", timestamp: "09:03" },
      ],
      outcome: "success",
      metrics: { resolution: 100, empathy: 95, compliance: 100, accuracy: 100 },
      issues: [],
    },
    "changed-mind": {
      id: "sim-5",
      scenario: "Changed Mind - Store Credit",
      messages: [
        { role: "user", text: "I just changed my mind about this jacket.", timestamp: "16:01" },
        { role: "agent", text: "No problem at all. Would you like a full refund, or I can offer store credit with a 10% bonus applied to your next purchase?", timestamp: "16:02", groundings: ["Policy: Store credit gets 10% bonus"] },
        { role: "user", text: "I'll take the store credit.", timestamp: "16:03" },
        { role: "agent", text: "Excellent! $55 store credit has been applied to your account. It never expires. Is there anything else?", timestamp: "16:04" },
      ],
      outcome: "success",
      metrics: { resolution: 100, empathy: 90, compliance: 100, accuracy: 100 },
      issues: [],
    },
    "missing-info": {
      id: "sim-6",
      scenario: "Missing Order Info",
      messages: [
        { role: "user", text: "I need to return something but I can't find my order number.", timestamp: "13:01" },
        { role: "agent", text: "No worries, I can look that up for you. Can you provide the email address associated with the order?", timestamp: "13:02" },
        { role: "user", text: "john@example.com", timestamp: "13:03" },
        { role: "agent", text: "Found it! Order #77777 - Wireless Mouse, placed 2 weeks ago. How can I help with this order?", timestamp: "13:04", groundings: ["Skill: lookup_order by email"] },
      ],
      outcome: "success",
      metrics: { resolution: 95, empathy: 92, compliance: 100, accuracy: 95 },
      issues: [],
    },
  };
  return convos[scenarioId] || convos["defective-happy"];
};

export default function SimulationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SimConversation[]>([]);
  const [expandedSim, setExpandedSim] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/simulations/scenarios");
        const data = await res.json();
        setScenarios((data.scenarios || []) as Scenario[]);
      } catch (e) {
        console.error("Failed to fetch scenarios", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const runSimulation = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);

    try {
      const res = await fetch("/api/simulations/run-suite", { method: "POST" });
      const data = await res.json();
      const runs = (data.runs || []).map((r: Record<string, unknown>) => ({
        ...r,
        scenario: (r.scenario_name as string) ?? (r.scenario as string) ?? "",
      })) as SimConversation[];
      setResults(runs);
      setProgress(100);
    } catch (e) {
      // fallback to local simulation if API fails
      for (let i = 0; i < scenarios.length; i++) {
        setProgress(Math.round(((i + 1) / scenarios.length) * 100));
        const sim = generateSimConversation(scenarios[i].id);
        await new Promise((r) => setTimeout(r, 400));
        setResults((prev) => [...prev, sim]);
      }
    }

    setIsRunning(false);
  };

  const successCount = results.filter((r) => r.outcome === "success").length;
  const partialCount = results.filter((r) => r.outcome === "partial").length;
  const failureCount = results.filter((r) => r.outcome === "failure").length;
  const avgResolution = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.metrics.resolution, 0) / results.length)
    : 0;

  const filteredResults = activeTab === "all"
    ? results
    : results.filter((r) => r.outcome === activeTab);

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
            <FlaskConical className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Simulation Engine</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Test before <span className="text-gradient">you deploy</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Auto-generate simulated conversations, evaluate outcomes against measurable criteria, 
            and catch regressions before they reach customers.
          </p>
        </motion.div>

        {/* Control Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold mb-1">Run Simulation Suite</h3>
                  <p className="text-sm text-muted-foreground">
                    {scenarios.length} scenarios covering happy paths, edge cases, and policy boundaries
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="border-white/10"
                    disabled={results.length === 0}
                    onClick={() => { setResults([]); setExpandedSim(null); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={runSimulation}
                    disabled={isRunning}
                    className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {isRunning ? "Running..." : "Run Suite"}
                  </Button>
                </div>
              </div>

              {isRunning && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/5" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Summary */}
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-muted-foreground">Pass</span>
                  </div>
                  <div className="text-3xl font-semibold text-green-400">{successCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-muted-foreground">Partial</span>
                  </div>
                  <div className="text-3xl font-semibold text-yellow-400">{partialCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-muted-foreground">Fail</span>
                  </div>
                  <div className="text-3xl font-semibold text-red-400">{failureCount}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-[#c4a574]" />
                    <span className="text-sm text-muted-foreground">Avg Resolution</span>
                  </div>
                  <div className="text-3xl font-semibold text-[#c4a574]">{avgResolution}%</div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Filter Tabs */}
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#141414] border border-white/5">
                <TabsTrigger value="all" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                  All ({results.length})
                </TabsTrigger>
                <TabsTrigger value="success" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                  Pass ({successCount})
                </TabsTrigger>
                <TabsTrigger value="partial" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
                  Partial ({partialCount})
                </TabsTrigger>
                <TabsTrigger value="failure" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                  Fail ({failureCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>
        )}

        {/* Simulation Results */}
        <div className="space-y-4">
          {filteredResults.map((sim, i) => (
            <motion.div
              key={sim.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`bg-[#141414] border-white/5 ${sim.outcome === "failure" ? "border-red-500/20" : sim.outcome === "partial" ? "border-yellow-500/20" : "border-green-500/20"}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge className={
                        sim.outcome === "success" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                        sim.outcome === "partial" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                        "bg-red-500/20 text-red-400 border-red-500/30"
                      }>
                        {sim.outcome === "success" ? "PASS" : sim.outcome === "partial" ? "PARTIAL" : "FAIL"}
                      </Badge>
                      <span className="font-medium">{sim.scenario}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setExpandedSim(expandedSim === sim.id ? null : sim.id)}
                    >
                      {expandedSim === sim.id ? "Collapse" : "View Details"}
                      <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${expandedSim === sim.id ? "rotate-180" : ""}`} />
                    </Button>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {Object.entries(sim.metrics).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="text-lg font-semibold">{val}%</div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{key}</div>
                        <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                          <div className={`h-1 rounded-full ${val >= 90 ? "bg-green-400" : val >= 70 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Issues */}
                  {sim.issues.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      {sim.issues.map((issue, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-red-300">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded Conversation */}
                  <AnimatePresence>
                    {expandedSim === sim.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/5 pt-4"
                      >
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {sim.messages.map((msg, j) => (
                            <div key={j} className={`flex gap-3 ${msg.role === "user" ? "" : "flex-row-reverse"}`}>
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#c4a574]/20" : "bg-blue-500/20"}`}>
                                {msg.role === "user" ? <User className="h-4 w-4 text-[#c4a574]" /> : <Bot className="h-4 w-4 text-blue-400" />}
                              </div>
                              <div className={`max-w-[70%] ${msg.role === "user" ? "" : "text-right"}`}>
                                <div className={`inline-block rounded-xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-[#0a0a0a] border border-white/10" : "bg-blue-500/10 border border-blue-500/20"}`}>
                                  {msg.text}
                                </div>
                                {msg.groundings && msg.groundings.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1 justify-end">
                                    {msg.groundings.map((g, k) => (
                                      <Badge key={k} variant="outline" className="text-[9px] h-4 border-[#c4a574]/30 text-[#c4a574]">
                                        {g}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {results.length === 0 && !isRunning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No simulations run yet</h3>
            <p className="text-muted-foreground text-sm">Click "Run Suite" to test your agent against all scenarios</p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
