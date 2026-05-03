"use client";

import { useState } from "react";
import ChatWidget from "@/components/chat-widget";

const TENANTS = [
  { id: "r-mobile", name: "R-Mobile", color: "#ef4444" },
  { id: "ichiba", name: "Ichiba", color: "#f97316" },
  { id: "r-travel", name: "RTravel", color: "#06b6d4" },
];

export default function WidgetDemoPage() {
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold">External Chat Widget</h1>
              <p className="text-sm text-muted-foreground">Test the embeddable chat widget per tenant</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Embed Instructions */}
        <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Embed Code</h2>
            <button
              onClick={() => setShowEmbed(!showEmbed)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {showEmbed ? "Hide" : "Show"}
            </button>
          </div>
          {showEmbed && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Add this script tag to any HTML page to embed the chat widget. The widget connects to your Sierra API and handles tenant context automatically.
              </p>
              <pre className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4 text-xs text-green-400 overflow-x-auto">
{`<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'http://localhost:3000/widget.js';
    s.setAttribute('data-tenant', 'r-mobile'); // or ichiba, r-travel
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`}
              </pre>
              <p className="text-xs text-muted-foreground">
                You can also test the widget by clicking the floating button in the bottom-right corner of this page.
              </p>
            </div>
          )}
        </div>

        {/* Tenant Cards */}
        <div>
          <h2 className="text-sm font-medium mb-4">Launch Widget by Tenant</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TENANTS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTenant(t.id)}
                className="text-left p-5 rounded-xl bg-[#141414] border border-white/5 hover:border-white/20 transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: t.color + "20" }}
                  >
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">Tenant: {t.id}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground group-hover:text-white/70 transition-colors">
                  Click to open chat widget configured for {t.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Iframe Test */}
        <div>
          <h2 className="text-sm font-medium mb-4">Iframe Embed Test</h2>
          <div className="bg-[#141414] border border-white/5 rounded-xl p-6">
            <p className="text-xs text-muted-foreground mb-4">
              The widget can also be embedded in an iframe for sandboxed environments:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TENANTS.map((t) => (
                <div key={t.id} className="space-y-2">
                  <div className="text-xs font-medium flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </div>
                  <div className="aspect-[4/5] bg-[#0a0a0a] border border-white/5 rounded-lg overflow-hidden">
                    <iframe
                      src={`/widget-iframe?tenant=${t.id}`}
                      className="w-full h-full"
                      style={{ border: "none" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Widget */}
      {activeTenant && (
        <>
          <ChatWidget defaultTenant={activeTenant} />
          <div className="fixed top-4 right-4 z-[60]">
            <button
              onClick={() => setActiveTenant(null)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Close Widget
            </button>
          </div>
        </>
      )}
    </div>
  );
}
