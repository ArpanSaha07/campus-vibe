---
description: Next.js app code — the binding design guidelines, the apiFetch boundary, and the build traps
paths:
  - "frontend/app/**"
  - "frontend/*.ts"
  - "frontend/*.mjs"
  - "frontend/*.json"
---

# Frontend

- **This is not the Next.js in your training data.** Read
  `node_modules/next/dist/docs/` before relying on a remembered API shape;
  `frontend/AGENTS.md` says the same thing and is the local authority.
- **[`design-guidelines.md`](../design-guidelines.md) is binding on all UI
  work.** For a brand-new surface, use `/frontend-design` on top of it, never
  instead of it.
- **Every backend call goes through `apiFetch`** (`app/lib/api.tsx`). The three
  data paths, the cache tags and the error-status mapping are in
  [`api-and-caching.md`](../docs/architecture/api-and-caching.md). **Per-user
  data must never enter Next's data cache.**
- **`npm run verify` before claiming green, and the production build must pass
  with the backend down.** A page that fetches at build time turns a dev machine
  that happens to have the backend running into a green build that fails in CI.
  (BUG-027)
- **`NEXT_PUBLIC_*` values are baked in at Docker build time**, not read at
  runtime — an empty one at build time stays empty forever. (BUG-004)
- **Client-side route protection does not execute.** Do not build anything that
  depends on it until BUG-003 is fixed; authorise on the server.
- **Reuse before adding** — `ClubEventTabButtons`, `ProtectedRoute`.
- **CSP headers are enforced** (`next.config.ts`). Inline scripts break them,
  and `unsafe-eval` is allowed in development only.
- **Never hand `next/image` a value that is not a root-relative path or an
  absolute http(s) URL.** It throws `Failed to construct 'URL': Invalid URL`
  *during render*, which no `onError` can catch, so one bad row takes the whole
  page down. Uploaded media arrives as an S3 object key and must go through
  `adapters.ts`, which maps it to `/media/...`. (BUG-040)
- **`next/image` needs a `remotePatterns` entry for any absolute host**, and
  Next 16 refuses outright to optimize an upstream image on a private IP — which
  local development always is. Same-origin paths behind the `/media/**` rewrite
  avoid both, and avoid the hydration mismatch that emitting a per-side absolute
  URL would cause. (BUG-040)
- **`apiFetch` must not set `Content-Type` for a `FormData` body** — the header
  carries the multipart boundary and only the browser knows it. Set it and every
  `@RequestPart` arrives missing.
