"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SettingsIntegrationsPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/integrations"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}
