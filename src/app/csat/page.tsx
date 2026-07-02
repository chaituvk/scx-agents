"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, CheckCircle, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EMOJI = ["😞", "😕", "😐", "🙂", "😄"];
const LABELS = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"];

function CSATForm() {
  const params = useSearchParams();
  const conversationId = params.get("conversation_id") ?? "";
  const tenantId = params.get("tenant_id") ?? undefined;

  const [score, setScore] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!score || !conversationId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/csat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tenantId ? { "x-tenant-id": tenantId } : {}),
        },
        body: JSON.stringify({ conversationId, score, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!conversationId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Invalid survey link.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-14 h-14 mx-auto mb-4 text-green-500" />
        <h2 className="text-xl font-semibold mb-2">Thank you for your feedback!</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Your response helps us improve the support experience. We read every rating.
        </p>
      </div>
    );
  }

  const active = hover ?? score;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-1">How was your experience?</h2>
        <p className="text-sm text-muted-foreground">Rate your recent support conversation</p>
      </div>

      {/* Star rating */}
      <div className="flex justify-center gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setScore(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            className="group focus:outline-none"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl transition-transform group-hover:scale-110 select-none" style={{ lineHeight: 1 }}>
                {EMOJI[n - 1]}
              </span>
              <Star
                className={`w-5 h-5 transition-colors ${active && n <= active ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
              />
            </div>
          </button>
        ))}
      </div>

      {active && (
        <p className="text-center text-sm font-medium text-foreground">
          {LABELS[active - 1]}
        </p>
      )}

      {/* Comment box */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Tell us more (optional)
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could we do better? What did you love?"
          rows={3}
          className="text-sm resize-none bg-background border-border"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={!score || submitting}
        className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <CheckCircle className="w-4 h-4 mr-2" />
        )}
        Submit Feedback
      </Button>
    </div>
  );
}

export default function CSATPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#c4a574] to-[#8b7355]" />
            <span className="text-lg font-semibold">Sierra</span>
          </div>
          <p className="text-xs text-muted-foreground">Customer Satisfaction Survey</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <Suspense fallback={
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          }>
            <CSATForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Sierra AI · Your feedback is private
        </p>
      </div>
    </div>
  );
}
