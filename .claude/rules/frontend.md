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
- **CSP headers are enforced** (`next.config.ts:62-78`). Inline scripts break
  them, and `unsafe-eval` is allowed in development only.
