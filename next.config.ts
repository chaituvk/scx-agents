import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // image can run `node server.js` without shipping the full node_modules
  // tree. Portable across a Supabase-hosted DB + any container host
  // (Docker, AWS ECS/Fargate, GCP Cloud Run).
  output: "standalone",
};

export default nextConfig;
