"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  FileText,
  MessageSquare,
  Image,
  Mic,
  ArrowRight,
  Check,
  Loader2,
  Cpu,
  Shield,
  Globe,
  MessageCircle,
  Zap,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const inputMethods = [
  { icon: FileText, title: "Upload Documents", desc: "PDFs, Word docs, SOPs, policy manuals", color: "bg-blue-500/20 text-blue-400" },
  { icon: MessageSquare, title: "Paste Transcripts", desc: "Chat logs, call recordings, support tickets", color: "bg-green-500/20 text-green-400" },
  { icon: Image, title: "Upload Media", desc: "Whiteboard photos, screenshots, diagrams", color: "bg-purple-500/20 text-purple-400" },
  { icon: Mic, title: "Audio Recordings", desc: "Voice memos, meeting recordings, interviews", color: "bg-orange-500/20 text-orange-400" },
];

const generationSteps = [
  { label: "Analyzing inputs...", progress: 15, icon: FileText },
  { label: "Extracting intents & entities...", progress: 35, icon: Cpu },
  { label: "Building conversation flows...", progress: 55, icon: MessageCircle },
  { label: "Connecting knowledge sources...", progress: 70, icon: Globe },
  { label: "Applying guardrails...", progress: 85, icon: Shield },
  { label: "Finalizing agent...", progress: 100, icon: Check },
];

const generatedAgent = {
  name: "Returns & Support Agent",
  description: "Handles product returns, exchanges, and general support inquiries",
  goals: ["Process returns within policy", "Offer exchanges when applicable", "Upsell warranty plans", "Escalate edge cases"],
  skills: ["lookup_order", "process_return", "check_warranty", "apply_discount", "escalate_to_human"],
  guardrails: ["No refunds over $500 without approval", "Verify identity for account changes", "Never share customer PII", "Escalate legal threats immediately"],
  languages: ["English", "Spanish", "French"],
  channels: ["Web Chat", "Email", "SMS"],
};

export default function GhostwriterPage() {
  const [activeTab, setActiveTab] = useState("description");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [typedText, setTypedText] = useState("");
  const fullPrompt = "I want an agent that handles returns, checks order status, and can apply discount codes for frustrated customers. It should be empathetic but efficient, and never process refunds over $500 without manager approval.";

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= generationSteps.length - 1) {
            clearInterval(interval);
            setTimeout(() => setShowResult(true), 500);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (showResult) return;
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullPrompt.slice(0, i));
      i++;
      if (i > fullPrompt.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [showResult]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setCurrentStep(0);
    setShowResult(false);
  };

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#c4a574] to-[#8b7355] mb-6"
          >
            <Sparkles className="h-8 w-8 text-[#0a0a0a]" />
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-4">
            <span className="text-gradient">Ghostwriter</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Describe your goal in plain English. We will build a production-ready AI agent — complete with guardrails, skills, and multichannel deployment.
          </p>
        </motion.div>

        {/* Input Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
        >
          {inputMethods.map((method, i) => (
            <motion.div
              key={method.title}
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <Card className="bg-[#141414] border-white/5 h-full hover:border-[#c4a574]/20 transition-colors cursor-pointer group">
                <CardContent className="p-6">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${method.color}`}>
                    <method.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-[#c4a574] transition-colors">
                    {method.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{method.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Builder Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Side */}
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-base">Describe Your Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                  <TabsList className="bg-[#0a0a0a] border border-white/5">
                    <TabsTrigger value="description" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">Text</TabsTrigger>
                    <TabsTrigger value="document" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">Document</TabsTrigger>
                    <TabsTrigger value="transcript" className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574]">Transcript</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative">
                  <textarea
                    className="w-full h-48 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-[#c4a574]/50 resize-none font-mono"
                    value={typedText}
                    readOnly
                  />
                  {!isGenerating && !showResult && (
                    <div className="absolute bottom-4 right-4">
                      <Button
                        onClick={handleGenerate}
                        className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Agent
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Output Side */}
            <Card className="bg-[#141414] border-white/5 min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[#c4a574]" />
                  Generated Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {!isGenerating && !showResult ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-64 flex flex-col items-center justify-center text-muted-foreground"
                    >
                      <Sparkles className="h-12 w-12 mb-4 opacity-30" />
                      <p>Your AI agent will appear here</p>
                    </motion.div>
                  ) : isGenerating && !showResult ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {generationSteps.slice(0, currentStep + 1).map((step, i) => (
                        <motion.div
                          key={step.label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-3">
                            {i === currentStep && currentStep < generationSteps.length - 1 ? (
                              <Loader2 className="h-4 w-4 text-[#c4a574] animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-400" />
                            )}
                            <span className="text-sm">{step.label}</span>
                          </div>
                          {i === currentStep && (
                            <Progress value={step.progress} className="h-1 bg-white/5" />
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-lg bg-[#c4a574]/20 flex items-center justify-center">
                          <Cpu className="h-5 w-5 text-[#c4a574]" />
                        </div>
                        <div>
                          <div className="font-semibold">{generatedAgent.name}</div>
                          <div className="text-xs text-muted-foreground">{generatedAgent.description}</div>
                        </div>
                        <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30">Ready</Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Goals</div>
                          <div className="flex flex-wrap gap-2">
                            {generatedAgent.goals.map((g) => (
                              <Badge key={g} variant="outline" className="border-white/10">{g}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Skills</div>
                          <div className="flex flex-wrap gap-2">
                            {generatedAgent.skills.map((s) => (
                              <Badge key={s} className="bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Guardrails</div>
                          <div className="space-y-1">
                            {generatedAgent.guardrails.map((g) => (
                              <div key={g} className="flex items-center gap-2 text-sm">
                                <Shield className="h-3 w-3 text-[#c4a574]" />
                                {g}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Languages</div>
                            <div className="flex gap-1">
                              {generatedAgent.languages.map((l) => (
                                <Badge key={l} variant="outline" className="border-white/10 text-xs">{l}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Channels</div>
                            <div className="flex gap-1">
                              {generatedAgent.channels.map((c) => (
                                <Badge key={c} variant="outline" className="border-white/10 text-xs">{c}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                          Deploy Agent
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/10">
                          Edit in Studio
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Before/After */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold text-center mb-10">From weeks to minutes</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#141414] border-white/5 border-l-4 border-l-red-500/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4 text-red-400">
                  <Clock className="h-5 w-5" />
                  <span className="font-semibold">Before Ghostwriter</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    Manual flow diagramming in whiteboard tools
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    Weeks of engineering time to implement
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    Scattered documentation across Confluence, Notion, Google Docs
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    Iteration cycles take days
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-[#141414] border-white/5 border-l-4 border-l-green-500/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4 text-green-400">
                  <Zap className="h-5 w-5" />
                  <span className="font-semibold">With Ghostwriter</span>
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    AI generates complete agent from description
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    Production-ready in under 15 minutes
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    All knowledge sources auto-connected
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    Iterate instantly with natural language
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "Avg. Build Time", value: "12 min", icon: Clock },
            { label: "Agents Created", value: "15,000+", icon: Cpu },
            { label: "Languages Supported", value: "40+", icon: Globe },
            { label: "First-Pass Accuracy", value: "94%", icon: TrendingUp },
          ].map((stat, i) => (
            <Card key={stat.label} className="bg-[#141414] border-white/5 text-center">
              <CardContent className="p-6">
                <stat.icon className="h-6 w-6 text-[#c4a574] mx-auto mb-3" />
                <div className="text-2xl font-semibold mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </main>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
