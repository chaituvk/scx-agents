import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The parent scx-agents repo has its own package-lock.json. Pin Turbopack's
  // workspace root to this app so it doesn't pick up middleware/source from
  // the parent.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
