// Versioned re-export of the streaming orchestrator endpoint.
// runtime and dynamic must be declared locally — Next.js can't statically
// analyse them through a re-export chain.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { POST } from "@/app/api/orchestrator/stream/route";
