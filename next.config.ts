import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // image can run `node server.js` without shipping the full node_modules
  // tree. Portable across a Supabase-hosted DB + any container host
  // (Docker, AWS ECS/Fargate, GCP Cloud Run).
  output: "standalone",

  // Native / server-only modules must not be bundled by the compiler —
  // they are loaded from node_modules at runtime instead. better-sqlite3 is
  // a native addon (local fallback only); pg is the Postgres driver.
  serverExternalPackages: ["better-sqlite3", "pg"],
};

export default nextConfig;
