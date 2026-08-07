import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone — a self-contained server with only the modules the
  // build actually traced. Without it the production image has no way to run
  // except by copying the whole node_modules, which drags every devDependency
  // into a shipping artifact. That is how tar, a build-time dependency of
  // @tailwindcss/oxide, ended up failing the Trivy CRITICAL gate on an image
  // that never runs Tailwind (BUG-016).
  output: "standalone",
};

export default nextConfig;
