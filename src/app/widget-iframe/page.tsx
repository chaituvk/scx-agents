"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatWidget from "@/components/chat-widget";

function WidgetIframeInner() {
  const searchParams = useSearchParams();
  const tenant = searchParams.get("tenant") || "r-mobile";

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ChatWidget defaultTenant={tenant} />
    </div>
  );
}

export default function WidgetIframePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0a0a0a]" />}>
      <WidgetIframeInner />
    </Suspense>
  );
}
