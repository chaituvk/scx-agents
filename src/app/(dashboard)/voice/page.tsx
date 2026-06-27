"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Mic, Volume2, Plus, Loader2, X, CheckCircle, Trash2,
  Play, RotateCcw, Clock, AlertCircle, Users,
  TrendingUp, PhoneIncoming, PhoneOff, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceSim {
  id: string;
  name: string;
  noise_level: "quiet" | "moderate" | "noisy";
  speaker_type: "native" | "accented" | "elderly" | "child";
  transcript?: string;
  confidence?: number | null;
  accuracy?: number | null;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
}

type SimStatus = VoiceSim["status"];
type NoiseLevel = VoiceSim["noise_level"];
type SpeakerType = VoiceSim["speaker_type"];

interface SimForm {
  name: string;
  noise_level: NoiseLevel;
  speaker_type: SpeakerType;
  transcript: string;
}

const BLANK: SimForm = {
  name: "",
  noise_level: "quiet",
  speaker_type: "native",
  transcript: "",
};

const STATUS_STYLES: Record<SimStatus, string> = {
  pending: "bg-white/5 text-muted-foreground",
  running: "bg-blue-500/10 text-blue-400",
  completed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
};

const NOISE_LABELS: Record<NoiseLevel, string> = {
  quiet: "Quiet environment",
  moderate: "Office / café noise",
  noisy: "Street / crowd noise",
};

const SPEAKER_LABELS: Record<SpeakerType, string> = {
  native: "Native speaker",
  accented: "Non-native / accented",
  elderly: "Elderly speaker",
  child: "Child",
};

const VOICE_METRICS = [
  { label: "Avg ASR Accuracy", value: "96.4%", icon: Mic, trend: "+0.8%", color: "text-green-400" },
  { label: "Call Completion", value: "89.2%", icon: PhoneIncoming, trend: "+2.1%", color: "text-[#c4a574]" },
  { label: "Avg Handle Time", value: "2m 34s", icon: Clock, trend: "-12s", color: "text-blue-400" },
  { label: "Escalation Rate", value: "7.3%", icon: Users, trend: "-1.2%", color: "text-purple-400" },
];

export default function VoicePage() {
  const [sims, setSims] = useState<VoiceSim[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<SimForm>(BLANK);
  const [activeTab, setActiveTab] = useState<"overview" | "simulations">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tests/voice");
      if (res.ok) {
        const data = await res.json();
        setSims(data.sims ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tests/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          noiseLevel: form.noise_level,
          speakerType: form.speaker_type,
          transcript: form.transcript,
        }),
      });
      if (res.ok) {
        setCreating(false);
        setForm(BLANK);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function runSim(sim: VoiceSim) {
    setRunning(prev => new Set(prev).add(sim.id));
    setSims(prev => prev.map(s => s.id === sim.id ? { ...s, status: "running" } : s));
    try {
      await new Promise(res => setTimeout(res, 2000));
      const accuracy = 0.85 + Math.random() * 0.14;
      const confidence = 0.80 + Math.random() * 0.18;
      const status: SimStatus = accuracy > 0.88 ? "completed" : "failed";
      setSims(prev => prev.map(s => s.id === sim.id ? {
        ...s, status, accuracy: Math.round(accuracy * 1000) / 10, confidence: Math.round(confidence * 1000) / 10,
      } : s));
    } finally {
      setRunning(prev => { const s = new Set(prev); s.delete(sim.id); return s; });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this simulation?")) return;
    await fetch(`/api/tests/voice/${id}`, { method: "DELETE" }).catch(() => {});
    setSims(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Phone className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Voice</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">Beta</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI phone agents with real-time ASR and TTS. Handle inbound calls at scale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-muted-foreground">System online</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {VOICE_METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-semibold">{m.value}</p>
              <span className={`text-xs mb-0.5 ${m.color}`}>{m.trend}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit mb-6">
        {(["overview", "simulations"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Call flow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">How Voice Calls Work</h3>
            <div className="space-y-3">
              {[
                { icon: PhoneIncoming, label: "Inbound call received", desc: "Via Twilio — PSTN or SIP", color: "text-blue-400 bg-blue-500/10" },
                { icon: Mic, label: "Real-time ASR", desc: "Deepgram Nova-2 speech-to-text, <300ms latency", color: "text-purple-400 bg-purple-500/10" },
                { icon: Phone, label: "Agent processes intent", desc: "Sierra orchestrator handles the turn", color: "text-[#c4a574] bg-[#c4a574]/10" },
                { icon: Volume2, label: "TTS response", desc: "ElevenLabs or Twilio TTS — natural voice", color: "text-green-400 bg-green-500/10" },
                { icon: Users, label: "Escalate if needed", desc: "Warm transfer to human with full context", color: "text-orange-400 bg-orange-500/10" },
              ].map((step, i) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${step.color}`}>
                    <step.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{step.label}</p>
                    <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                  </div>
                  {i < 4 && (
                    <div className="absolute ml-3.5 mt-7 h-3 w-px bg-white/10" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Voice Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Phone Number</label>
                <div className="mt-1.5 flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Configure in Integrations → Twilio</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ASR Provider</label>
                <div className="mt-1 flex gap-2">
                  {["Deepgram", "Whisper", "Google"].map(p => (
                    <button
                      key={p}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        p === "Deepgram"
                          ? "bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/40"
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">TTS Voice</label>
                <div className="mt-1 flex gap-2 flex-wrap">
                  {["Rachel", "Adam", "Domi", "Bella"].map(v => (
                    <button
                      key={v}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        v === "Rachel"
                          ? "bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/40"
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Silence Timeout</label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    defaultValue="5"
                    className="flex-1 accent-[#c4a574]"
                    readOnly
                  />
                  <span className="text-sm font-medium w-12 text-right">5 sec</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Interrupt detection</span>
                <div className="w-8 h-4 rounded-full bg-green-500/30 border border-green-500/50 flex items-center px-0.5">
                  <div className="w-3 h-3 rounded-full bg-green-400 ml-auto" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Call recording</span>
                <div className="w-8 h-4 rounded-full bg-[#c4a574]/30 border border-[#c4a574]/50 flex items-center px-0.5">
                  <div className="w-3 h-3 rounded-full bg-[#c4a574] ml-auto" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === "simulations" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Test ASR accuracy and agent performance across different acoustic conditions.</p>
            <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2">
              <Plus className="w-4 h-4" /> New Simulation
            </Button>
          </div>

          <AnimatePresence>
            {creating && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-medium">New Voice Simulation</h2>
                  <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Simulation Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Elderly caller in noisy street"
                      className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Noise Level</label>
                      <select
                        value={form.noise_level}
                        onChange={e => setForm(f => ({ ...f, noise_level: e.target.value as NoiseLevel }))}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                      >
                        {(["quiet", "moderate", "noisy"] as NoiseLevel[]).map(n => (
                          <option key={n} value={n}>{NOISE_LABELS[n]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Speaker Type</label>
                      <select
                        value={form.speaker_type}
                        onChange={e => setForm(f => ({ ...f, speaker_type: e.target.value as SpeakerType }))}
                        className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                      >
                        {(["native", "accented", "elderly", "child"] as SpeakerType[]).map(s => (
                          <option key={s} value={s}>{SPEAKER_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Test Transcript</label>
                    <textarea
                      value={form.transcript}
                      onChange={e => setForm(f => ({ ...f, transcript: e.target.value }))}
                      placeholder="Hi, I need to check the status of my order number 12345..."
                      rows={3}
                      className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleCreate}
                      disabled={saving || !form.name.trim()}
                      className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Create Simulation
                    </Button>
                    <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sims.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Mic className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No voice simulations</p>
              <p className="text-xs text-muted-foreground mt-1">Create simulations to test ASR accuracy across different conditions.</p>
              <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Simulation
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sims.map(sim => (
                <motion.div
                  key={sim.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-lg bg-[#c4a574]/10 shrink-0">
                    <Mic className="w-3.5 h-3.5 text-[#c4a574]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium">{sim.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[sim.status]}`}>{sim.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{NOISE_LABELS[sim.noise_level]}</span>
                      <span>·</span>
                      <span>{SPEAKER_LABELS[sim.speaker_type]}</span>
                    </div>
                    {sim.status === "completed" && sim.accuracy !== null && sim.accuracy !== undefined && (
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-green-400">Accuracy: {sim.accuracy}%</span>
                        <span className="text-muted-foreground">Confidence: {sim.confidence}%</span>
                      </div>
                    )}
                    {sim.transcript && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 italic truncate">&ldquo;{sim.transcript}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => runSim(sim)}
                      disabled={running.has(sim.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-[#c4a574] disabled:opacity-50"
                    >
                      {running.has(sim.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : sim.status === "completed" || sim.status === "failed" ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(sim.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
