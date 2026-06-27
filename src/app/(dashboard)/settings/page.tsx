"use client";

import { useState, useEffect } from "react";
import { Settings, Palette, Bot, Save, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  accent_color: string;
  welcome_message: string;
  tone: string;
  logo_url: string | null;
  support_email: string | null;
  timezone: string;
  language: string;
  max_tokens_per_turn: number;
  inactivity_timeout_mins: number;
}

type Tab = "general" | "appearance" | "ai";

const TONE_OPTIONS = [
  { value: "empathetic", label: "Empathetic" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "enthusiastic", label: "Enthusiastic" },
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
];

export default function TenantSettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [form, setForm] = useState<Partial<TenantSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/tenant");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.tenant);
        setForm(data.tenant);
      } else {
        showToast("error", "Failed to load settings");
      }
    } catch {
      showToast("error", "Network error loading settings");
    } finally {
      setLoading(false);
    }
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  function setField<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.tenant);
        setForm(data.tenant);
        showToast("success", "Settings saved successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", (err as { error?: string }).error ?? "Failed to save settings");
      }
    } catch {
      showToast("error", "Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "ai", label: "AI Behavior", icon: <Bot className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Settings className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Tenant Settings</h1>
              <p className="text-muted-foreground text-sm">Manage your organisation's configuration</p>
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? (
              <>Saving…</>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-6 flex items-center gap-3 p-4 rounded-lg border text-sm ${
              toast.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-700"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {toast.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {toast.message}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* General tab */}
        {tab === "general" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Information</CardTitle>
              <CardDescription>Basic details about your organisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1 block">Organisation Name</label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Support Email</label>
                <Input
                  type="email"
                  value={form.support_email ?? ""}
                  onChange={(e) => setField("support_email", e.target.value)}
                  placeholder="support@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Timezone</label>
                <select
                  value={form.timezone ?? "UTC"}
                  onChange={(e) => setField("timezone", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Language</label>
                <select
                  value={form.language ?? "en"}
                  onChange={(e) => setField("language", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appearance tab */}
        {tab === "appearance" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Branding</CardTitle>
                <CardDescription>Customise how your chat widget looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-sm font-medium mb-1 block">Logo URL</label>
                  <Input
                    value={form.logo_url ?? ""}
                    onChange={(e) => setField("logo_url", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Primary Colour</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primary_color ?? "#c4a574"}
                        onChange={(e) => setField("primary_color", e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-input"
                      />
                      <Input
                        value={form.primary_color ?? "#c4a574"}
                        onChange={(e) => setField("primary_color", e.target.value)}
                        placeholder="#c4a574"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Accent Colour</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.accent_color ?? "#0a0a0a"}
                        onChange={(e) => setField("accent_color", e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-input"
                      />
                      <Input
                        value={form.accent_color ?? "#0a0a0a"}
                        onChange={(e) => setField("accent_color", e.target.value)}
                        placeholder="#0a0a0a"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chat Widget Preview</CardTitle>
                <CardDescription>How your widget will appear to customers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-4">
                  <div
                    className="w-72 rounded-xl shadow-lg overflow-hidden border"
                    style={{ borderColor: form.primary_color ?? "#c4a574" }}
                  >
                    {/* Widget header */}
                    <div
                      className="p-4 flex items-center gap-3"
                      style={{ backgroundColor: form.primary_color ?? "#c4a574" }}
                    >
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt="logo"
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: form.accent_color ?? "#0a0a0a", color: "#fff" }}
                        >
                          {(form.name ?? "A").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white font-semibold text-sm">{form.name ?? "Support"}</span>
                    </div>
                    {/* Widget body */}
                    <div className="p-4 bg-background space-y-2">
                      <div
                        className="text-xs rounded-xl rounded-tl-none px-3 py-2 max-w-[80%] text-white"
                        style={{ backgroundColor: form.accent_color ?? "#0a0a0a" }}
                      >
                        {form.welcome_message || "Hello! How can I help you today?"}
                      </div>
                      <div className="text-xs rounded-xl rounded-tr-none px-3 py-2 max-w-[80%] ml-auto bg-muted text-foreground">
                        Hi, I need some help
                      </div>
                    </div>
                    {/* Widget footer */}
                    <div className="px-4 pb-4 bg-background">
                      <div
                        className="flex items-center gap-2 border rounded-full px-3 py-2"
                        style={{ borderColor: form.primary_color ?? "#c4a574" }}
                      >
                        <span className="text-xs text-muted-foreground flex-1">Type a message…</span>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: form.primary_color ?? "#c4a574" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                            <path d="M1 9L9 5L1 1V4.5L6.5 5L1 5.5V9Z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Behavior tab */}
        {tab === "ai" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Behaviour</CardTitle>
              <CardDescription>Configure how your AI agent interacts with customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1 block">Welcome Message</label>
                <textarea
                  value={form.welcome_message ?? ""}
                  onChange={(e) => setField("welcome_message", e.target.value)}
                  placeholder="Hello! How can I help you today?"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tone</label>
                <select
                  value={form.tone ?? "empathetic"}
                  onChange={(e) => setField("tone", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Sets the conversational style for all AI agents in this tenant
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Max Tokens per Turn
                  <span className="text-muted-foreground font-normal ml-1">
                    (current: {form.max_tokens_per_turn ?? 2000})
                  </span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={8000}
                  step={100}
                  value={form.max_tokens_per_turn ?? 2000}
                  onChange={(e) => setField("max_tokens_per_turn", Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>100 (concise)</span>
                  <span>8000 (verbose)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Limits how many tokens the AI can generate per response
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Inactivity Timeout
                  <span className="text-muted-foreground font-normal ml-1">
                    ({form.inactivity_timeout_mins ?? 30} minutes)
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={120}
                  step={1}
                  value={form.inactivity_timeout_mins ?? 30}
                  onChange={(e) => setField("inactivity_timeout_mins", Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 min</span>
                  <span>120 min</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Close conversations automatically after this period of inactivity
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom save button */}
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? (
              <>Saving…</>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
