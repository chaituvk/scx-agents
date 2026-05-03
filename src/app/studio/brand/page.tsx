"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Palette,
  Type,
  Image,
  Ban,
  Sparkles,
  Eye,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface BrandConfig {
  agentName: string;
  welcomeMessage: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  tone: "empathetic" | "professional" | "casual" | "enthusiastic";
  offLimitTopics: string[];
  offLimitPhrases: string[];
  requireApproval: boolean;
  approvalThreshold: number;
}

const defaultConfig: BrandConfig = {
  agentName: "Sierra Support",
  welcomeMessage: "Hello! I'm here to help with your questions. What can I assist you with today?",
  logo: "",
  primaryColor: "#c4a574",
  accentColor: "#0a0a0a",
  tone: "empathetic",
  offLimitTopics: ["Politics", "Competitor comparisons", "Legal advice", "Medical advice"],
  offLimitPhrases: ["I don't know", "That's not my job", "You're wrong", "Calm down"],
  requireApproval: true,
  approvalThreshold: 500,
};

const toneDescriptions: Record<string, string> = {
  empathetic: "Warm, understanding, patient. Uses phrases like 'I understand' and 'I apologize'.",
  professional: "Clear, concise, formal. Focused on resolution speed and accuracy.",
  casual: "Friendly, approachable, uses contractions. Relatable but still helpful.",
  enthusiastic: "Energetic, positive, uses exclamation points. Great for sales and onboarding.",
};

const toneExamples: Record<string, string> = {
  empathetic: "I completely understand how frustrating that must be. Let me make this right for you.",
  professional: "I acknowledge the issue with your order. I will process a replacement within 24 hours.",
  casual: "Oh no, that's not what we want! Let me fix this for you right away.",
  enthusiastic: "I'm so excited to help you with this! Let me get that sorted out for you right now!",
};

export default function BrandPage() {
  const [config, setConfig] = useState<BrandConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [previewMsg, setPreviewMsg] = useState("My order hasn't arrived yet. It's been 2 weeks.");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/brand/config");
        const data = await res.json();
        setConfig({
          agentName: (data.agentName as string) ?? defaultConfig.agentName,
          welcomeMessage: (data.welcomeMessage as string) ?? defaultConfig.welcomeMessage,
          logo: (data.logo as string) ?? defaultConfig.logo,
          primaryColor: (data.primaryColor as string) ?? defaultConfig.primaryColor,
          accentColor: (data.accentColor as string) ?? defaultConfig.accentColor,
          tone: (data.tone as BrandConfig["tone"]) ?? defaultConfig.tone,
          offLimitTopics: (data.offLimitTopics as string[]) ?? defaultConfig.offLimitTopics,
          offLimitPhrases: (data.offLimitPhrases as string[]) ?? defaultConfig.offLimitPhrases,
          requireApproval: (data.requireApproval as boolean) ?? defaultConfig.requireApproval,
          approvalThreshold: (data.approvalThreshold as number) ?? defaultConfig.approvalThreshold,
        });
      } catch (e) {
        console.error("Failed to fetch brand config", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      await fetch("/api/brand/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save brand config", e);
    }
  };

  const addTopic = () => {
    if (newTopic.trim() && !config.offLimitTopics.includes(newTopic.trim())) {
      setConfig({ ...config, offLimitTopics: [...config.offLimitTopics, newTopic.trim()] });
      setNewTopic("");
    }
  };

  const addPhrase = () => {
    if (newPhrase.trim() && !config.offLimitPhrases.includes(newPhrase.trim())) {
      setConfig({ ...config, offLimitPhrases: [...config.offLimitPhrases, newPhrase.trim()] });
      setNewPhrase("");
    }
  };

  const getToneResponse = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("not arrive") || lower.includes("late") || lower.includes("missing")) {
      switch (config.tone) {
        case "empathetic": return "I'm so sorry your order hasn't arrived yet. Two weeks is far too long. Let me check on this right away and see what's happening.";
        case "professional": return "I acknowledge the delay with your order. I will investigate the shipment status and provide an update within the hour.";
        case "casual": return "Ugh, that's annoying! Let me track that package down for you right now.";
        case "enthusiastic": return "Oh no, that's definitely not the experience we want! Let me jump on this immediately and get it to you ASAP!";
      }
    }
    return "I can help you with that.";
  };

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
            <Palette className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Brand Studio</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Define your <span className="text-gradient">agent's voice</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Customize your agent's name, welcome message, tone, and off-limits filters. 
            Preview every change in real-time.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Config Panel */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-3">
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-base">Brand Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="identity" className="w-full">
                  <TabsList className="bg-[#0a0a0a] border border-white/5 w-full">
                    <TabsTrigger value="identity" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Identity
                    </TabsTrigger>
                    <TabsTrigger value="tone" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                      <Type className="h-4 w-4 mr-2" />
                      Tone & Voice
                    </TabsTrigger>
                    <TabsTrigger value="guardrails" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">
                      <Ban className="h-4 w-4 mr-2" />
                      Guardrails
                    </TabsTrigger>
                  </TabsList>

                  {/* Identity Tab */}
                  <TabsContent value="identity" className="mt-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Agent Name</label>
                      <Input
                        value={config.agentName}
                        onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                        className="bg-[#0a0a0a] border-white/10"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Welcome Message</label>
                      <Textarea
                        value={config.welcomeMessage}
                        onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                        className="bg-[#0a0a0a] border-white/10 min-h-[80px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{config.welcomeMessage.length} characters</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Primary Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.primaryColor}
                            onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                            className="h-10 w-10 rounded-lg bg-transparent border-0 cursor-pointer"
                          />
                          <Input value={config.primaryColor} className="bg-[#0a0a0a] border-white/10 font-mono text-sm" readOnly />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Accent Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.accentColor}
                            onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                            className="h-10 w-10 rounded-lg bg-transparent border-0 cursor-pointer"
                          />
                          <Input value={config.accentColor} className="bg-[#0a0a0a] border-white/10 font-mono text-sm" readOnly />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Logo</label>
                      <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center">
                        <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Drop logo here or click to upload</p>
                        <p className="text-xs text-muted-foreground">PNG, SVG up to 2MB</p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tone Tab */}
                  <TabsContent value="tone" className="mt-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Tone Preset</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(["empathetic", "professional", "casual", "enthusiastic"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setConfig({ ...config, tone: t })}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              config.tone === t
                                ? "border-[#c4a574] bg-[#c4a574]/10"
                                : "border-white/5 bg-[#0a0a0a] hover:border-white/10"
                            }`}
                          >
                            <div className="font-medium capitalize mb-1">{t}</div>
                            <div className="text-xs text-muted-foreground">{toneDescriptions[t]}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                      <div className="text-xs text-muted-foreground mb-2">Example Response</div>
                      <div className="text-sm">{toneExamples[config.tone]}</div>
                    </div>
                  </TabsContent>

                  {/* Guardrails Tab */}
                  <TabsContent value="guardrails" className="mt-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Off-Limit Topics</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {config.offLimitTopics.map((topic, i) => (
                          <Badge key={i} className="bg-red-500/20 text-red-300 border-red-500/30 h-7 gap-1">
                            {topic}
                            <button onClick={() => setConfig({ ...config, offLimitTopics: config.offLimitTopics.filter((_, j) => j !== i) })}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a topic..."
                          value={newTopic}
                          onChange={(e) => setNewTopic(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addTopic()}
                          className="bg-[#0a0a0a] border-white/10"
                        />
                        <Button onClick={addTopic} size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-3 block">Off-Limit Phrases</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {config.offLimitPhrases.map((phrase, i) => (
                          <Badge key={i} className="bg-red-500/20 text-red-300 border-red-500/30 h-7 gap-1">
                            "{phrase}"
                            <button onClick={() => setConfig({ ...config, offLimitPhrases: config.offLimitPhrases.filter((_, j) => j !== i) })}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a phrase..."
                          value={newPhrase}
                          onChange={(e) => setNewPhrase(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addPhrase()}
                          className="bg-[#0a0a0a] border-white/10"
                        />
                        <Button onClick={addPhrase} size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                      <div>
                        <div className="font-medium">Require Approval</div>
                        <div className="text-xs text-muted-foreground">Agent must get approval for high-value actions</div>
                      </div>
                      <Switch
                        checked={config.requireApproval}
                        onCheckedChange={(v) => setConfig({ ...config, requireApproval: v })}
                      />
                    </div>

                    {config.requireApproval && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Approval Threshold ($)</label>
                        <Input
                          type="number"
                          value={config.approvalThreshold}
                          onChange={(e) => setConfig({ ...config, approvalThreshold: Number(e.target.value) })}
                          className="bg-[#0a0a0a] border-white/10"
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <Button onClick={handleSave} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                    {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {saved ? "Saved!" : "Save Changes"}
                  </Button>
                  <Button variant="outline" className="border-white/10" onClick={() => setConfig(defaultConfig)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Preview Panel */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            <Card className="bg-[#141414] border-white/5 sticky top-24">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#c4a574]" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Welcome Message */}
                <div className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                  <div className="text-xs text-muted-foreground mb-1">Welcome Message</div>
                  <div className="text-sm">{config.welcomeMessage}</div>
                </div>

                {/* Chat Preview */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Test a message</div>
                  <Textarea
                    value={previewMsg}
                    onChange={(e) => setPreviewMsg(e.target.value)}
                    className="bg-[#0a0a0a] border-white/10 min-h-[60px] text-sm mb-3"
                  />
                  <div className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                    <div className="flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ backgroundColor: config.primaryColor, color: config.accentColor }}>
                        {config.agentName.charAt(0)}
                      </div>
                      <div className="text-sm">{getToneResponse(previewMsg)}</div>
                    </div>
                  </div>
                </div>

                {/* Brand Colors */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Brand Colors</div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="h-10 rounded-lg mb-1" style={{ backgroundColor: config.primaryColor }} />
                      <div className="text-xs text-center text-muted-foreground">Primary</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-10 rounded-lg mb-1 border border-white/10" style={{ backgroundColor: config.accentColor }} />
                      <div className="text-xs text-center text-muted-foreground">Accent</div>
                    </div>
                  </div>
                </div>

                {/* Tone Badge */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Current Tone</div>
                  <Badge className="bg-[#c4a574]/20 text-[#c4a574] capitalize">{config.tone}</Badge>
                </div>

                {/* Guardrail Check */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Guardrail Check</div>
                  {config.offLimitPhrases.some((p) => getToneResponse(previewMsg).toLowerCase().includes(p.toLowerCase())) ? (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      Off-limit phrase detected in response
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <Check className="h-4 w-4" />
                      Response passes guardrail check
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
