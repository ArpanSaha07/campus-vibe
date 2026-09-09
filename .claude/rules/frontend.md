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
- **Never call a success callback inside the `try` that wraps the write.**
  Navigation, a context refresh and `revalidateTag` all run *after* the write
  succeeded, so a throw there is caught by the write's own `catch` and the form
  tells the user nothing was saved when it was. Call it past the
  `try/finally`, through a ref, behind `typeof cb === 'function'`. (BUG-045)
- **Then `await` it, in a `catch` of its own.** Moving it out is only half the
  fix: these callbacks are `async`, so calling one without awaiting drops the
  promise and a rejection becomes an unhandled rejection — the form has already
  blanked itself and says nothing at all. Report it as its own outcome, which
  is not the write failing: the row exists and the caller owns it. (BUG-047)
- **`ApiError.message` is the raw response body**, so rendering it shows the
  user a line of JSON. Go through `parseApiError` (`app/lib/auth-errors.ts`).
  (BUG-045)
- **`.ticket-label` uppercases.** It is for printed labels — `DATE`, `URL`,
  `REQUIRED` — never for a literal value: it rendered a club slug as
  `QUANTUM-COMPUTING-SOCIETY` in a URL preview. Use `font-mono` alone for
  values.
- **A stale Turbopack dev bundle lies about the source.** It reported `Module
  not found` for a file present on disk and in `HEAD`, and `onSuccess is not a
  function` for a hook whose signature had changed — both while `npx tsc
  --noEmit` and `npm run build` were clean. If an error contradicts the file in
  front of you, restart `campusvibe-frontend` before debugging it. (BUG-045)
