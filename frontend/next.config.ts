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

// The browser needs to reach the API directly, and its address differs per
// environment. Read at build time because that is when the header value is
// baked, exactly like NEXT_PUBLIC_API_URL itself.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Content-Security-Policy, and the security headers that pair with it.
 *
 * Defence in depth for the fact that the JWT is readable by page scripts
 * ([BUG-003]). CSP does not fix that — only moving the token to an httpOnly
 * cookie does — but it narrows what an injected script can do and where it can
 * send anything it steals.
 *
 * Two entries are load-bearing and must not be removed casually:
 *
 *   script-src  https://accounts.google.com — Google Identity Services is
 *               loaded from there at runtime by GoogleProvider and
 *               GoogleAuthButton. Drop it and Google sign-in silently stops
 *               rendering, with only a CSP violation in the console to say why.
 *   frame-src   https://accounts.google.com — GIS renders its button and its
 *               consent flow in an iframe.
 *
 * `'unsafe-inline'` on script-src is a real weakening and is deliberate: Next
 * inlines bootstrap and flight-data scripts, and removing it needs per-request
 * nonces threaded through middleware. Worth doing, not worth blocking this on.
 * It still blocks the case that matters most here — loading an attacker's
 * script from an origin we did not name.
 */
// `next dev` evaluates modules with eval() — measured at 119 blocked evals on a
// single page load before this exception existed. The production build does not,
// so the allowance is scoped to development rather than weakening the policy
// that actually ships. If a production page ever reports an eval violation, the
// answer is to find what needs it, not to move this line.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline'",
  // Uploaded club images are same-origin: they come through the /media rewrite
  // below rather than from the API host directly, so 'self' covers them and
  // img-src does not have to name the API.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com`,
  "frame-src https://accounts.google.com",
].join("; ");

const nextConfig: NextConfig = {
  output: isVercel ? undefined : "standalone",

  images: {
    // Only Unsplash, which the demo clubs' photos come from. Uploaded images
    // are served from this origin through the /media rewrite below, so they are
    // local as far as next/image is concerned and need no entry here.
    remotePatterns: [new URL("https://images.unsplash.com/**")],
  },

  /**
   * Uploaded club media, proxied to the API.
   *
   * What the database stores is an S3 object key, and the bucket is private, so
   * the bytes are streamed by `GET /api/v1/clubs/{id}/logo`. Pointing an
   * <Image> straight at the API host does not work, for three separate reasons
   * that this one rewrite removes together:
   *
   *  - the optimizer runs on the *server*, where `localhost:8080` is the
   *    frontend container itself, not the backend — it fetches API_INTERNAL_URL
   *    here instead, the same split `apiFetch` already makes;
   *  - emitting a different absolute URL per side would make the server and
   *    client renders disagree about `src`, which is a hydration mismatch;
   *  - Next 16 refuses to optimize an upstream image on a private IP, which
   *    local development always is.
   *
   * So the src is a plain same-origin path — `/media/clubs/{id}/logo` — which
   * is identical on both sides, needs no remotePatterns entry, and is covered
   * by `img-src 'self'`.
   *
   * Read at request time rather than baked, so unlike NEXT_PUBLIC_* this one
   * is not subject to [BUG-004].
   */
  async rewrites() {
    const apiInternal = process.env.API_INTERNAL_URL || apiOrigin;
    return [
      {
        source: "/media/clubs/:clubId/logo",
        destination: `${apiInternal}/api/v1/clubs/:clubId/logo`,
      },
      {
        source: "/media/clubs/:clubId/images/:index",
        destination: `${apiInternal}/api/v1/clubs/:clubId/images/:index`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Stops a response being reinterpreted as a script or stylesheet.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors above covers modern browsers; this covers the rest.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here uses any of these, so refuse them outright.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
