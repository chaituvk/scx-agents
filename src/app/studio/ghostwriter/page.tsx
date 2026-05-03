"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  FileText,
  MessageSquare,
  Mic,
  Upload,
  Wand2,
  Check,
  ArrowRight,
  Loader2,
  BookOpen,
  Headphones,
  Zap,
  Bug,
  Play,
  AlertTriangle,
  Save,
  GitBranch,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface GeneratedJourney {
  name: string;
  description: string;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
    label?: string;
  }>;
  variables: string[];
  guardrails: string[];
  skills: string[];
}

const SAMPLE_DESCRIPTION = `Create a return workflow for an e-commerce store:
1. Greet the customer warmly
2. Ask for their order number
3. Look up the order and check if it's within the 30-day return window
4. If outside window, offer store credit with 10% bonus
5. If inside window, ask for the reason (defective, wrong item, or changed mind)
6. For defective items: offer free replacement OR full refund + prepaid label
7. For wrong items: ship correct item immediately, arrange pickup
8. For changed mind: offer store credit (10% bonus) or refund minus $5 restocking fee
9. Process the refund within 3-5 business days
10. Close by asking if there's anything else

Guardrails:
- Never insult the product or brand
- Never blame the customer
- Always offer solution before transferring
- Maximum refund without approval: $500`;

const SAMPLE_TRANSCRIPT = `Agent: Hi! Thanks for contacting support. How can I help?
Customer: I want to return these shoes. They're too small.
Agent: No problem! Can I get your order number?
Customer: It's #98765
Agent: Great. I see you ordered the Trail Runner Pro, size 10, 12 days ago. You're within our return window.
Customer: Yeah, they just don't fit right.
Agent: I understand. Would you like an exchange for size 11, or a full refund?
Customer: I'll take the refund.
Agent: Done! You'll receive a prepaid return label via email within 5 minutes. The refund will hit your original payment method in 3-5 business days.
Customer: Perfect, thanks!
Agent: You're welcome! Is there anything else?
Customer: Nope, that's it.
Agent: Have a great day!`;

export default function GhostwriterPage() {
  const [activeTab, setActiveTab] = useState("describe");
  const [inputText, setInputText] = useState(SAMPLE_DESCRIPTION);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GeneratedJourney | null>(null);
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>("");

  const generationSteps = [
    { label: "Sending to LLM...", progress: 15 },
    { label: "Analyzing workflow structure...", progress: 35 },
    { label: "Extracting intents and guardrails...", progress: 55 },
    { label: "Building conversation nodes...", progress: 75 },
    { label: "Saving to database...", progress: 95 },
    { label: "Done!", progress: 100 },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setResult(null);
    setSavedJourneyId(null);
    setError(null);
    setLogs([]);
    setProvider("");

    for (let i = 0; i < 3; i++) {
      setStepLog(i);
      await delay(300);
    }

    try {
      const res = await fetch("/api/ghostwriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: inputText, sourceType: activeTab }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || `HTTP ${res.status}`);
      }

      setProvider(data.generated?.model || "LLM");
      setResult(data.generated);
      setSavedJourneyId(data.journey?.id || null);

      for (let i = 3; i < generationSteps.length; i++) {
        setStepLog(i);
        await delay(200);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const setStepLog = (i: number) => {
    setProgress(generationSteps[i].progress);
    setLogs((prev) => [...prev, `✓ ${generationSteps[i].label}`]);
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "start": return Play;
      case "message": return MessageSquare;
      case "input": return BookOpen;
      case "condition": return Zap;
      case "action": return Wand2;
      case "api": return GitBranch;
      case "intent": return Type;
      case "transfer": return Headphones;
      case "end": return Check;
      default: return Sparkles;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case "start": return "text-green-400 bg-green-500/10";
      case "message": return "text-blue-400 bg-blue-500/10";
      case "input": return "text-purple-400 bg-purple-500/10";
      case "condition": return "text-yellow-400 bg-yellow-500/10";
      case "action": return "text-pink-400 bg-pink-500/10";
      case "api": return "text-cyan-400 bg-cyan-500/10";
      case "intent": return "text-indigo-400 bg-indigo-500/10";
      case "transfer": return "text-red-400 bg-red-500/10";
      case "end": return "text-gray-400 bg-gray-500/10";
      default: return "text-[#c4a574] bg-[#c4a574]/10";
    }
  };

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Ghostwriter</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Build agents from <span className="text-gradient">natural language</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Describe your workflow in plain English. Ghostwriter uses an LLM to analyze, extract
            guardrails, and generate a production-ready conversation journey with nodes and edges.
          </p>
        </motion.div>

        {/* Provider hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Bug className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Supports <span className="text-[#c4a574]">Ollama (local)</span>,{" "}
                <span className="text-[#c4a574]">OpenAI</span>, or{" "}
                <span className="text-[#c4a574]">Anthropic</span>. Set{" "}
                <code className="text-xs bg-white/5 px-1 rounded">OPENAI_API_KEY</code>,{" "}
                <code className="text-xs bg-white/5 px-1 rounded">ANTHROPIC_API_KEY</code>, or run{" "}
                <code className="text-xs bg-white/5 px-1 rounded">ollama run llama3.2</code>.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Input Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10">
          <Card className="bg-[#141414] border-white/5">
            <CardHeader>
              <CardTitle className="text-base">Source Material</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                <TabsList className="bg-[#0a0a0a] border border-white/5">
                  <TabsTrigger value="describe" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                    <Type className="h-4 w-4 mr-2" />
                    Describe in English
                  </TabsTrigger>
                  <TabsTrigger value="sop" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                    <FileText className="h-4 w-4 mr-2" />
                    SOP / Policy
                  </TabsTrigger>
                  <TabsTrigger value="transcript" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Transcript
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                    <Mic className="h-4 w-4 mr-2" />
                    Audio
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="describe" className="mt-4">
                  <textarea
                    className="w-full h-64 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-[#c4a574]/50"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Describe your workflow in plain English..."
                  />
                </TabsContent>
                <TabsContent value="sop" className="mt-4">
                  <textarea
                    className="w-full h-64 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-[#c4a574]/50"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="transcript" className="mt-4">
                  <textarea
                    className="w-full h-64 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-[#c4a574]/50"
                    value={SAMPLE_TRANSCRIPT}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="audio" className="mt-4">
                  <div className="h-64 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Drag audio files here or click to upload</p>
                    <p className="text-xs mt-1">MP3, WAV, M4A up to 100MB</p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bug className="h-3.5 w-3.5" />
                  Ghostwriter generates journeys via LLM and auto-saves to the database
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !inputText.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? "Building Journey..." : "Generate Journey"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-10">
              <Card className="bg-[#141414] border-red-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Generation Failed</span>
                  </div>
                  <p className="text-sm text-red-300">{error}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Make sure you have an LLM provider configured. For local dev, run:{' '}
                    <code className="bg-white/5 px-1 rounded">ollama run llama3.2</code>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generation Progress */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-10">
              <Card className="bg-[#141414] border-white/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="h-5 w-5 text-[#c4a574] animate-spin" />
                    <span className="font-medium">Generating conversation journey...</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/5 mb-4" />
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-muted-foreground">
                        {log}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="bg-[#141414] border-[#c4a574]/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">{result.name}</h2>
                      <p className="text-sm text-muted-foreground">{result.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider && (
                        <Badge variant="outline" className="border-[#c4a574]/30 text-[#c4a574]">
                          {provider}
                        </Badge>
                      )}
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Save className="h-3 w-3 mr-1" />
                        Saved
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="rounded-lg bg-[#0a0a0a] p-4 text-center">
                      <div className="text-2xl font-semibold">{result.nodes.length}</div>
                      <div className="text-xs text-muted-foreground">Conversation Nodes</div>
                    </div>
                    <div className="rounded-lg bg-[#0a0a0a] p-4 text-center">
                      <div className="text-2xl font-semibold">{result.guardrails.length}</div>
                      <div className="text-xs text-muted-foreground">Guardrails</div>
                    </div>
                    <div className="rounded-lg bg-[#0a0a0a] p-4 text-center">
                      <div className="text-2xl font-semibold">{result.skills.length}</div>
                      <div className="text-xs text-muted-foreground">Skills</div>
                    </div>
                  </div>

                  {/* Generated Nodes */}
                  <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-medium mb-3">Generated Workflow</h3>
                    {result.nodes.map((node, i) => {
                      const Icon = getNodeIcon(node.type);
                      return (
                        <motion.div
                          key={node.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-white/5"
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${getNodeColor(node.type)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{node.label}</div>
                            {typeof node.data.text === "string" && node.data.text && (
                              <div className="text-xs text-muted-foreground truncate">{node.data.text}</div>
                            )}
                            {typeof node.data.prompt === "string" && node.data.prompt && (
                              <div className="text-xs text-muted-foreground truncate">{node.data.prompt}</div>
                            )}
                            {typeof node.data.variable === "string" && node.data.variable && (
                              <Badge variant="outline" className="mt-1 text-[10px] h-5 border-white/10">
                                var: {node.data.variable}
                              </Badge>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Edges */}
                  {result.edges.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3">Connections</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.edges.map((edge) => (
                          <Badge key={edge.id} variant="outline" className="text-[10px] h-6 border-white/10">
                            {edge.source} → {edge.target}
                            {edge.condition && <span className="text-[#c4a574] ml-1">({edge.condition})</span>}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guardrails */}
                  {result.guardrails.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3">Extracted Guardrails</h3>
                      <div className="space-y-2">
                        {result.guardrails.map((g, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <Shield className="h-4 w-4 text-[#c4a574] mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{g}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {result.skills.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3">Composable Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.skills.map((s) => (
                          <Badge key={s} className="bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Variables */}
                  {result.variables.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3">Variables</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.variables.map((v) => (
                          <Badge key={v} variant="outline" className="text-[10px] h-5 border-purple-500/30 text-purple-400">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                      onClick={() => window.location.href = `/studio/flows?id=${savedJourneyId}`}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Open in Flow Builder
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/10"
                      onClick={() => window.open(`/api/journeys/${savedJourneyId}`, "_blank")}
                    >
                      View JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
