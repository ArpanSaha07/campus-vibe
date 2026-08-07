import type { NextConfig } from "next";

// `output: standalone` emits .next/standalone — a self-contained server with
// only the modules the build actually traced. The production Docker image needs
// it: without it the runner stage has no way to run except by copying the whole
// node_modules, which drags every devDependency into a shipping artifact. That
// is how tar, a build-time dependency of @tailwindcss/oxide, ended up failing
// the Trivy CRITICAL gate on an image that never runs Tailwind (BUG-016).
//
// It must be off on Vercel, which does its own file tracing and never produces
// the .next/next-server.js.nft.json that Next's standalone step then tries to
// read — `next build` dies with ENOENT before emitting anything (BUG-017). The
// standalone path is the only caller of that read, so switching it off is a
// complete fix rather than a workaround.
//
// Self-hosting is the default and Vercel is the exception, deliberately: a
// plain `npm run build` then produces exactly what the Docker image ships, and
// `npm start` (scripts/start-standalone.mjs) has a bundle to serve.
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  output: isVercel ? undefined : "standalone",
};

export default nextConfig;
