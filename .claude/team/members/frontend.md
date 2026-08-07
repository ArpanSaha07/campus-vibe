# frontend — working memory

**This file is my memory across sessions.** I start every spawn with no
recollection of previous work. What is written here is what I know.

Record what surprised me, what I tried that did not work, and what I would tell
myself starting cold. Do not record what the code already says.

---

## My tasks

| # | Task | Status | Source |
|---|---|---|---|
| — | *(none assigned)* | | |

## Map of my area

`frontend/app/` — App Router with three route groups:
`(auth)/login` · `(main)/{clubs,events}/[id]` · `(protected)/{admin,dashboard,club-dashboard,create-club,create-event,my-events}`.

Components: `components/ui/` (Button, Chip, EmptyState, SectionHeading, StatTile)
plus feature folders `auth-components/`, `club/`, `event/`, `main-page/`,
`user-profile-page-components/`, and top-level `Navbar`, `Footer`, `SearchBar`,
`ProtectedRoute`, `PhotoFileUploadPreview`.

Data layer: `lib/api.tsx` (fetch wrapper), `lib/auth-context.tsx`,
`lib/{club,event,user,search}.tsx`, `lib/services/clubService.ts`,
`lib/validators/clubValidator.ts`, `lib/adapters.ts`, `hooks/useCreateClubForm.ts`.
Types: `app/types/index.ts` and `app/types/google-identity.d.ts`.

Stack: Next 16.2, React 19.1, Tailwind v4, TypeScript 5. Deps are deliberately
thin — `axios`, `lucide-react`, `swiper`. Tests: Jest + React Testing Library,
23 passing.

## Things I have learned about this codebase

- **There is no component library.** `components/ui/` is bespoke against Tailwind
  v4 `@theme` tokens in `app/globals.css`. Adding shadcn/ui or similar is a
  design-system decision that needs `design` and an ADR — not a quiet import.
  Tokens are lavender / berry / ink / mist, defined in
  [`design-guidelines.md`](../../design-guidelines.md).
- **Tailwind v4 has no `tailwind.config.js`** — tokens live in `@theme` inside
  `globals.css`. Looking for a config file wastes time.
- `app/types/index.ts` **mirrors the backend contract**. When it disagrees with a
  DTO, the backend is right and this has drifted. Changing the contract itself is
  a conversation with `backend`, not a unilateral edit.
- **`(window as any)` hid a real bug once** — BUG-014. `client_id` was passed
  `undefined` because the guard did not narrow into a nested closure, and Google
  Identity Services *silently ignores* options it cannot use, so there was no
  error at all. Types for GIS now live in `app/types/google-identity.d.ts`. Do
  not reach for `any` on an external global.
- **Lint gates merges since 2026-08-05.** `npm run lint` must be clean —
  0 errors. Warnings are tolerated (15 currently).
- **Local dev is `docker compose watch`,** not `npm run dev` on the host. The
  container runs the `dev` stage of `frontend/Dockerfile`. Source edits sync and
  hot-reload; a `package.json` change triggers a full image rebuild.
- **`NEXT_PUBLIC_*` is read at runtime in dev but inlined at build time in the
  production image**, which passes no build args — so production ships them empty
  ([BUG-004](../../bugs/bugs.md#bug-004)). Do not assume dev behaviour holds.
- **Route protection is broken; BUG-003's stated cause is partly stale.**
  Verified 2026-08-06: `frontend/proxy.tsx:6` exports a **named** `proxy` rather
  than a default, and `:7` reads `request.cookies.get('token')` while the JWT
  lives in `localStorage` — so it cannot see a token even if it runs.
  [BUG-003](../../bugs/bugs.md#bug-003) additionally calls the *filename* wrong,
  but that predates the Next 16 upgrade, which renamed `middleware.ts` →
  `proxy.ts`. A compiled `middleware.js` **does** exist under `.next/server/`,
  which suggests Next is picking the file up now. Re-verify before repeating the
  filename claim. The cookie/localStorage mismatch is the solid half.

## What I tried that did not work

*(empty — record dead ends here so I do not repeat them next session)*

## Open threads

- Most of the UI is built but **unwired**. The next big push is API integration,
  which lands only after the backend endpoints and the JWT decision exist.
