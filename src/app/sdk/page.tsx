"use client";

import { motion } from "framer-motion";
import {
  Code2,
  Puzzle,
  GitBranch,
  SlidersHorizontal,
  GitPullRequest,
  FlaskConical,
  Bug,
  Terminal,
  Check,
  ArrowRight,
  Copy,
  Play,
  Zap,
  Layers,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: Puzzle,
    title: "Composable Skills",
    description:
      "Build reusable skill modules that agents can mix and match. Share skills across teams, version them independently, and compose complex behaviors from simple primitives.",
  },
  {
    icon: GitBranch,
    title: "Multi-agent Orchestration",
    description:
      "Agents calling agents. Design hierarchical systems where specialist agents delegate tasks, consult experts, and coordinate to solve complex customer requests.",
  },
  {
    icon: SlidersHorizontal,
    title: "Tuning Controls",
    description:
      "Fine-tune creativity vs determinism with granular sliders. Control temperature, top-p, repetition penalty, and response length per agent or per skill.",
  },
  {
    icon: GitPullRequest,
    title: "CI/CD Integration",
    description:
      "Native GitHub Actions support for automated testing, staging deployments, and production rollouts. Every pull request gets a preview environment with live agent simulation.",
  },
  {
    icon: FlaskConical,
    title: "Simulation & Testing",
    description:
      "Run thousands of simulated conversations before deploying. Test edge cases, adversarial inputs, and multi-turn scenarios in a sandboxed environment.",
  },
  {
    icon: Bug,
    title: "Debugging",
    description:
      "Full trace inspection for every conversation. Step through reasoning chains, inspect tool calls, replay agent decisions, and identify failure modes at a glance.",
  },
];

const codeLines = [
  { num: 1, content: 'agent {', color: '#c4a574' },
  { num: 2, content: '  name: ', color: '#a89f94', value: '"CustomerSupport"', valueColor: '#8fbc8f' },
  { num: 3, content: '  model: ', color: '#a89f94', value: '"claude-3-5-sonnet"', valueColor: '#8fbc8f' },
  { num: 4, content: '  goals: [', color: '#c4a574' },
  { num: 5, content: '    ', color: '#a89f94', value: '"resolve_issues"', valueColor: '#8fbc8f' },
  { num: 6, content: '    ', color: '#a89f94', value: '"upsell_proactively"', valueColor: '#8fbc8f' },
  { num: 7, content: '  ],', color: '#c4a574' },
  { num: 8, content: '  guardrails: [', color: '#c4a574' },
  { num: 9, content: '    ', color: '#a89f94', value: '"no_medical_advice"', valueColor: '#8fbc8f' },
  { num: 10, content: '    ', color: '#a89f94', value: '"verify_identity"', valueColor: '#8fbc8f' },
  { num: 11, content: '  ],', color: '#c4a574' },
  { num: 12, content: '  skills: [', color: '#c4a574' },
  { num: 13, content: '    ', color: '#a89f94', value: '"lookup_order"', valueColor: '#8fbc8f' },
  { num: 14, content: '    ', color: '#a89f94', value: '"process_refund"', valueColor: '#8fbc8f' },
  { num: 15, content: '    ', color: '#a89f94', value: '"schedule_callback"', valueColor: '#8fbc8f' },
  { num: 16, content: '  ]', color: '#c4a574' },
  { num: 17, content: '}', color: '#c4a574' },
];

const cliCommands = [
  { type: "prompt" as const, text: "sierra deploy --env production" },
  { type: "output" as const, text: "✓ Validating agent manifest..." },
  { type: "output" as const, text: "✓ Running 1,247 simulation tests..." },
  { type: "output" as const, text: "✓ All guardrails passed" },
  { type: "output" as const, text: "✓ Skills resolved (3/3)" },
  { type: "success" as const, text: "→ Deployed CustomerSupport v2.4.1 to production" },
  { type: "output" as const, text: "" },
  { type: "prompt" as const, text: "sierra test --scenario escalation" },
  { type: "output" as const, text: "Running escalation scenario..." },
  { type: "output" as const, text: "  Turn 1: Greeting ✓" },
  { type: "output" as const, text: "  Turn 2: Identity verification ✓" },
  { type: "output" as const, text: "  Turn 3: Order lookup ✓" },
  { type: "output" as const, text: "  Turn 4: Refund approval → delegate to SupervisorAgent" },
  { type: "success" as const, text: "→ 14/14 tests passed (100%)" },
];

export default function SDKPage() {
  const [copied, setCopied] = useState(false);
  const [sliderValue, setSliderValue] = useState(65);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="relative min-h-screen bg-background pt-20">
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-[#c4a574]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-[#8b7355]/5 blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          custom={0}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-8">
            <Code2 className="h-4 w-4" />
            Developer Toolkit
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] mb-6">
            Agent SDK
          </h1>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            Build agents with code when you need the extra control.
            Declarative definitions, composable skills, and powerful
            orchestration — all in your IDE.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
            >
              <Terminal className="mr-2 h-4 w-4" />
              npm install @sierra/sdk
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 px-8 py-6 text-base"
            >
              Read the docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Code Editor Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mx-auto max-w-3xl"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden shadow-2xl">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#141414]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    support-agent.sierra
                  </span>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Editor Body */}
            <div className="flex">
              {/* Line Numbers */}
              <div className="select-none py-4 px-3 text-right border-r border-white/5">
                {codeLines.map((line) => (
                  <div
                    key={line.num}
                    className="text-xs text-muted-foreground/40 leading-6 font-mono"
                  >
                    {line.num}
                  </div>
                ))}
              </div>

              {/* Code Content */}
              <div className="flex-1 py-4 px-4 overflow-x-auto">
                {codeLines.map((line) => (
                  <div
                    key={line.num}
                    className="text-sm leading-6 font-mono whitespace-pre"
                  >
                    <span style={{ color: line.color }}>{line.content}</span>
                    {line.value && (
                      <span style={{ color: line.valueColor }}>{line.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-[#141414] text-[10px] text-muted-foreground/50">
              <div className="flex items-center gap-4">
                <span>typescript</span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Ln 17, Col 1</span>
                <span>17 lines</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Cards */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
            Everything you need to{" "}
            <span className="text-gradient">ship agents</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            From local development to production deployment, the Agent SDK
            provides a complete toolchain for building reliable AI agents.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="group h-full rounded-2xl border border-white/5 bg-[#141414] p-8 hover:border-[#c4a574]/20 transition-all">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4a574]/10 group-hover:bg-[#c4a574]/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-[#c4a574]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {feature.description}
                </p>

                {/* Special mockups for specific cards */}
                {feature.title === "Tuning Controls" && (
                  <div className="mt-6 rounded-lg border border-white/5 bg-[#0a0a0a] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">
                        Creativity
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Determinism
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-[#c4a574] transition-all"
                        style={{ width: `${sliderValue}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/50">
                      <span>temp: 0.3</span>
                      <span>top-p: 0.85</span>
                      <span>max: 2048</span>
                    </div>
                  </div>
                )}

                {feature.title === "CI/CD Integration" && (
                  <div className="mt-6 rounded-lg border border-white/5 bg-[#0a0a0a] p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        .github/workflows/deploy.yml
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded bg-white/5 w-full" />
                      <div className="h-1.5 rounded bg-white/5 w-4/5" />
                      <div className="h-1.5 rounded bg-[#c4a574]/20 w-3/5" />
                      <div className="h-1.5 rounded bg-white/5 w-full" />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="h-3 w-3 rounded-full bg-green-500/40" />
                      <span className="text-[10px] text-green-400/70">
                        All checks passing
                      </span>
                    </div>
                  </div>
                )}

                {feature.title === "Simulation & Testing" && (
                  <div className="mt-6 rounded-lg border border-white/5 bg-[#0a0a0a] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">
                        Test Suite
                      </span>
                      <span className="text-[10px] text-green-400/70">
                        1,247 passed
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { name: "Greeting", pct: 100 },
                        { name: "Escalation", pct: 98 },
                        { name: "Refund Flow", pct: 100 },
                        { name: "Edge Cases", pct: 96 },
                      ].map((test) => (
                        <div key={test.name} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-20">
                            {test.name}
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#c4a574]/60"
                              style={{ width: `${test.pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">
                            {test.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {feature.title === "Debugging" && (
                  <div className="mt-6 rounded-lg border border-white/5 bg-[#0a0a0a] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Bug className="h-3 w-3" />
                      <span>Trace ID: trace_8f2a9c</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { step: "Intent classification", time: "12ms" },
                        { step: "Guardrail check", time: "8ms" },
                        { step: "Skill: lookup_order", time: "45ms" },
                        { step: "Response generation", time: "320ms" },
                      ].map((step) => (
                        <div
                          key={step.step}
                          className="flex items-center justify-between py-1 border-b border-white/5 last:border-0"
                        >
                          <span className="text-[10px] text-muted-foreground">
                            {step.step}
                          </span>
                          <span className="text-[10px] text-[#c4a574]/60">
                            {step.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CLI Mockup */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
            Ship from the <span className="text-gradient">command line</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Deploy, test, and monitor your agents without leaving the terminal.
            The Sierra CLI integrates seamlessly with your existing workflow.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-3xl"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden shadow-2xl">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#141414]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  sierra — zsh
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-white/5" />
                <div className="h-4 w-4 rounded bg-white/5" />
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-6 font-mono text-sm leading-relaxed">
              {cliCommands.map((cmd, i) => (
                <div key={i} className="mb-1">
                  {cmd.type === "prompt" && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#c4a574]">$</span>
                      <span className="text-foreground">{cmd.text}</span>
                    </div>
                  )}
                  {cmd.type === "output" && cmd.text && (
                    <div className="text-muted-foreground/60">{cmd.text}</div>
                  )}
                  {cmd.type === "output" && !cmd.text && (
                    <div className="h-4" />
                  )}
                  {cmd.type === "success" && (
                    <div className="text-green-400/80">{cmd.text}</div>
                  )}
                </div>
              ))}
              {/* Cursor */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[#c4a574]">$</span>
                <span className="inline-block h-4 w-2 bg-[#c4a574]/60 animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Quick Start Section */}
      <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/5 bg-gradient-warm p-12 md:p-16 text-center"
        >
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[#c4a574]/10 mb-8">
            <Zap className="h-8 w-8 text-[#c4a574]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Ready to start building?
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground mb-10">
            Get up and running in minutes with our quickstart guide, example
            agents, and comprehensive API reference.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
            >
              <Play className="mr-2 h-4 w-4" />
              Quickstart Guide
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 px-8 py-6 text-base"
            >
              <Layers className="mr-2 h-4 w-4" />
              View Examples
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer spacer */}
      <div className="h-16" />
    </main>
  );
}
