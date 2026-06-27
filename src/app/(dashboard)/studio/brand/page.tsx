"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Palette, Loader2, CheckCircle, Save, MessageSquare, Eye, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandConfig {
  agentName: string;
  welcomeMessage: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  tone: string;
  offLimitTopics: string[];
  offLimitPhrases: string[];
  requireApproval: boolean;
  approvalThreshold: number;
}

const TONE_OPTIONS = ["professional", "friendly", "empathetic", "concise", "casual", "formal"];

const PREVIEW_MSGS = [
  "Hi there! I need help with my order.",
  "How can I reset my password?",
  "What are your business hours?",
];

function TagInput({ label, values, onChange, placeholder }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t || values.includes(t)) { setInput(""); return; }
    onChange([...values, t]);
    setInput("");
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10 min-h-[40px]">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 text-foreground">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-400 text-muted-foreground">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 min-w-24 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

export default function BrandPage() {
  const [config, setConfig] = useState<BrandConfig>({
    agentName: "AI Assistant",
    welcomeMessage: "Hi! How can I help you today?",
    logo: "",
    primaryColor: "#c4a574",
    accentColor: "#8b7355",
    tone: "friendly",
    offLimitTopics: [],
    offLimitPhrases: [],
    requireApproval: false,
    approvalThreshold: 0.8,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/brand/config")
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === "object") {
          setConfig(c => ({ ...c, ...data }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/brand/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof BrandConfig>(key: K, val: BrandConfig[K]) {
    setConfig(c => ({ ...c, [key]: val }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Brand</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Customize your AI agent&apos;s identity, tone, and visual appearance.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`gap-2 ${saved ? "bg-green-600 hover:bg-green-700" : "bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]"}`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <><CheckCircle className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Changes</>
          )}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Agent Identity</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Agent Name</label>
                <input
                  value={config.agentName}
                  onChange={e => set("agentName", e.target.value)}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Welcome Message</label>
                <textarea
                  value={config.welcomeMessage}
                  onChange={e => set("welcomeMessage", e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tone</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => set("tone", t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                        config.tone === t
                          ? "bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/40"
                          : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/20"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Colors */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Visual Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={e => set("primaryColor", e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    value={config.primaryColor}
                    onChange={e => set("primaryColor", e.target.value)}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Accent Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={config.accentColor}
                    onChange={e => set("accentColor", e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    value={config.accentColor}
                    onChange={e => set("accentColor", e.target.value)}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground font-mono"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Guardrails */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Content Controls</h3>
            <div className="space-y-4">
              <TagInput
                label="Off-limit Topics"
                values={config.offLimitTopics}
                onChange={v => set("offLimitTopics", v)}
                placeholder="e.g. politics, religion — press Enter"
              />
              <TagInput
                label="Off-limit Phrases"
                values={config.offLimitPhrases}
                onChange={v => set("offLimitPhrases", v)}
                placeholder="Exact phrases to never use — press Enter"
              />
              <div>
                <label className="text-xs text-muted-foreground">Approval Threshold</label>
                <p className="text-[10px] text-muted-foreground/60 mb-2">Confidence below this level flags messages for human review.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={config.approvalThreshold}
                    onChange={e => set("approvalThreshold", parseFloat(e.target.value))}
                    className="flex-1 accent-[#c4a574]"
                  />
                  <span className="text-sm font-medium w-10 text-right">{Math.round(config.approvalThreshold * 100)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Live Preview */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-1"
        >
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Live Preview</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
                style={{ backgroundColor: config.primaryColor + "15" }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {config.agentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{config.agentName || "Agent"}</p>
                  <p className="text-[10px] text-green-400">● Online</p>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3">
                {/* Welcome */}
                <div className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    {config.agentName.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="text-xs px-3 py-2 rounded-2xl rounded-tl-sm max-w-[80%] text-white"
                    style={{ backgroundColor: config.primaryColor + "20", border: `1px solid ${config.primaryColor}30` }}
                  >
                    {config.welcomeMessage || "Hi! How can I help?"}
                  </div>
                </div>

                {/* Sample exchange */}
                <div className="flex justify-end">
                  <div className="text-xs px-3 py-2 rounded-2xl rounded-tr-sm max-w-[80%] bg-white/10 text-foreground">
                    {PREVIEW_MSGS[0]}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    {config.agentName.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="text-xs px-3 py-2 rounded-2xl rounded-tl-sm max-w-[80%] text-white"
                    style={{ backgroundColor: config.primaryColor + "20", border: `1px solid ${config.primaryColor}30` }}
                  >
                    I&apos;d be happy to help! Could you please provide your order number?
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                  <input
                    readOnly
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <MessageSquare className="w-3 h-3 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
