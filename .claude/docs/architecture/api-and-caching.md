# API & Caching — Implementation & Design Decisions

**Status:** 2026-08-14, extended 2026-08-15 · branch `develop` · **live and
verified end-to-end against the running Docker stack.** Every claim below was
read from the code or measured; the two places where a rationale could not be
recovered say so.
**Authors:** main session.
**Code as of:** `e12cd19` for the backend sections. The **storage layers**,
**rules** and **client-query-library** sections were written on 2026-08-15
against the working tree at that date — `api.tsx`, `cache.ts`,
`followed-clubs-context.tsx`, the Server/Client split across every `page.tsx`,
and a grep confirming no `Cache-Control` or `ETag` anywhere in
`backend/src/main` were all re-read. The backend controller and repository
sections were **not** re-read and still describe `e12cd19`.

## In one paragraph

Every screen in CampusVibe gets its data from the Spring Boot API over plain
HTTP JSON, and the frontend keeps a thin layer in front of that so pages do not
each invent their own way of asking. The important recent change is that public
data — the club list, the event list, individual club and event pages — is now
held for five minutes instead of being re-fetched on every single page view, so
the database is asked far less often while the pages still feel current. Anything
personal to a signed-in user, such as which clubs you follow, is deliberately
*never* held that way, because a shared cache would hand one person's data to the
next visitor; the code refuses to do it rather than relying on anyone remembering.
The one thing worth knowing before deciding anything here: **the login token is
kept in browser storage, which means pages that need to know who you are cannot
be rendered on the server**, and that single fact is the ceiling on how fast the
signed-in parts of the app can get. Moving it to a cookie is the next significant
piece of work and it is already written up as [BUG-003](../../bugs/bugs.md#bug-003).

## Read this before you change anything here

- **`frontend/app/lib/api.tsx` is the only place that calls `fetch`.** Every
  other module goes through `apiFetch`. Adding a bare `fetch` elsewhere bypasses
  the base-URL switch, the error typing and the caching guard all at once.
- **The invariant that is easy to break:** `auth: true` and caching must never be
  combined. `apiFetch` throws if they are (`api.tsx:88`). Next keys its data
  cache on the URL, and the bearer token is not part of that key, so a cached
  authenticated response is one user's data served to the next caller. If that
  throw is ever in your way, the answer is not to remove it.
- **`ApiError.status` is load-bearing, not decoration.** The club and event pages
  route a 404 to `notFound()` and anything else to `error.tsx`. Collapsing the
  two is what used to tell a user their club had been deleted whenever the
  backend was merely down ([BUG-022](../../bugs/fixed_bugs.md#bug-022)).
- **A Server Component that fetches and takes no params will be prerendered at
  build time**, and the build then needs a live backend that CI does not have
  ([BUG-027](../../bugs/fixed_bugs.md#bug-027)). Run `npm run verify` before
  pushing — it builds against a closed port and reproduces exactly that failure.
- Bound by [`user-roles.md`](user-roles.md) for who may call what, and by
  [`ci-cd-pipeline.md`](ci-cd-pipeline.md) for how the checks run.
- Open defects: [`bugs.md`](../../bugs/bugs.md) · backlog:
  [`todo.md`](../../TODO/todo.md).

---

## Overview

The API is a conventional REST surface under `/api/v1`, served by Spring Boot,
consumed by a Next.js App Router frontend. There is no GraphQL layer, no BFF, and
no shared client generated from a schema — the contract is maintained by hand in
two places (`EventDTO`/`ClubDTO` on one side, `ApiEvent`/`ApiClub` in
`frontend/app/types/index.ts` on the other) and reconciled by adapters.

The one architectural idea that makes the rest legible: **the frontend has three
distinct data paths, and which one a page uses is decided by whether the data is
public and whether the page needs to know who is asking.**

| Path | Used for | Cached | Rendered |
|---|---|---|---|
| Server Component → `apiFetch` with a policy | `/clubs`, `/events`, club and event detail | 5 min, shared | Server |
| Client Component → `apiFetch` with `auth: true` | `/my-clubs`, `/my-events`, dashboards | Never | Browser |
| Client Component → `apiFetch` plain | search | Never | Browser |

The middle row is not a preference. The JWT lives in `localStorage`, which a
Server Component cannot read, so every authenticated page is forced into the
browser and pays a round trip to `/api/v1/users/me` before it can ask anything
else. That constraint shapes more of this design than any decision taken on
purpose.

Caching exists in exactly one layer: **Next's data cache, opted into per call.**
There is no Spring `@Cacheable`, no Redis, no HTTP `Cache-Control` on API
responses — all three verified absent by grep across `backend/src/main` and
`next.config.ts`. That is a real gap rather than a considered position, and it is
recorded below.

---

## Storage layers, and what owns what

### The principle

**No single browser storage mechanism is right for all of it.** Each layer has a
job, and the failure mode when one is used for another's job is always the same:
two copies of the truth that disagree. The corollary matters more than the rule —
**every piece of data has exactly one authoritative owner**, and every other copy
is a cache that must be able to be thrown away without losing anything.

What CampusVibe actually runs today, in full:

| Layer | Holds | Notes |
|---|---|---|
| PostgreSQL | Everything authoritative | The only source of truth |
| Next data cache | Public club and event reads, 5 min | The **only** data cache in the system |
| React context | The followed-clubs list, once per session | `followed-clubs-context.tsx`, the only client cache |
| `localStorage` | **One item: the JWT** | And that is the thing that should not be there |
| Caffeine (backend) | Auth and search rate-limit counters, lockout counters, **query embeddings** | Only the last is a data cache, and only of provider output — never of results |

There is **no Redis, no IndexedDB, no client query library, and no HTTP caching**
on API responses. Three of those are correct for the current scale; the fourth
(HTTP caching) is a real gap, recorded below.

The one backend cache that holds provider output rather than counters is
`QueryEmbeddingCache` (2026-08-15, [BUG-005](../../bugs/fixed_bugs.md#bug-005)).
It sits around the **embedding call only**, never around the ranked results —
results change whenever an event is added and must not be served stale, whereas
the embedding of the string *chess club* is the same forever.

### The shape of it

```text
                     PostgreSQL  ← source of truth
                          │
                   Spring Boot API
                    (no Cache-Control,
                     no ETag — a gap)
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
  Server Component                    Client Component
  apiFetch + policy                   apiFetch, auth: true
        │                                   │
  Next data cache                     never cached
  5 min, shared,                      (guard throws)
  tag-invalidatable                         │
        │                             React context for
  /clubs, /events,                    the one list read
  detail pages                        by many buttons
                                            │
                                     localStorage: JWT only
```

The asymmetry is the whole design. Public data is cached because it is the same
for everyone; per-user data is never cached because it is not, and `apiFetch`
enforces that rather than trusting anyone to remember.

### Where a new piece of data belongs

Ask in this order. Most answers are the first two.

| The data | Where | Why |
|---|---|---|
| Session credential | httpOnly cookie *(today: `localStorage`)* | Must not be readable by page scripts, and the server needs it before rendering. The gap is [BUG-003](../../bugs/bugs.md#bug-003) |
| Saved events, followed clubs, RSVPs | PostgreSQL | Must follow the user to another device and survive a cleared browser |
| Roles, club-admin links | PostgreSQL | Authorisation input; the JWT carries role *names* only, and ownership is re-checked per request |
| `email_verified`, `auth_provider` | PostgreSQL | Account facts, not display state |
| Club and event lists, detail pages | Next data cache, 5 min | Public, identical for everyone, changes a few times a day |
| Search results | Nothing | Unbounded query space; caching fills the store with entries never asked for twice. Deliberately absent from `cache.ts` |
| Planner prompt across a sign-in redirect | `sessionStorage` (`planner.ts`) | Survives one navigation, dies with the tab — which is the intended lifetime |
| Planner results | Page state | Not persisted. If *Save plan* is ever built, that is PostgreSQL, on an explicit user action |
| A grid-vs-list toggle, a dismissed banner | `localStorage` | None exist yet. When one does, this is where it goes — small, non-sensitive, disposable, no cross-device meaning |
| Anything the server must know before rendering | Cookie | `localStorage` is invisible to a Server Component. This is not a preference, it is a hard constraint |

### PostgreSQL is the source of truth

Browser storage is never authoritative for any of: users, clubs, events, saved
events, followed clubs, RSVPs, roles and club-admin relationships, verification
state, or auth tokens. All of it is server-owned, and every one of those is
re-read from the database on the request that depends on it — including the
principal itself, which `JWTAuthenticationFilter` loads by id on every
authenticated request rather than trusting the claims.

That last one is not incidental. It is the only reason deleting a user
immediately invalidates their token, and it is currently the system's *only*
revocation mechanism.

---

## File-by-file breakdown

### `frontend/app/lib/api.tsx` — the single HTTP boundary

Every request in the application passes through `apiFetch` (`api.tsx:81`). It
carries four responsibilities that would otherwise be scattered:

**Base URL by side (`api.tsx:15`).** In the browser the public URL is right; on
the server it is not, because inside the frontend container `localhost:8080` is
that container, not the backend. `API_INTERNAL_URL` is deliberately *not*
`NEXT_PUBLIC_` — a Docker service name is meaningless to a browser, so it must
stay out of the client bundle.

**Typed errors (`api.tsx:32`).** `ApiError` keeps the HTTP status as a field so
callers can distinguish *no such thing* from *the server is broken*. The message
stays the raw response body, so pre-existing callers and `parseApiError` behave
as before.

**The caching guard (`api.tsx:88`).** Combining `auth: true` with `revalidate` or
`tags` throws immediately, before the request is issued. See *Design decisions*.

**Empty bodies (`api.tsx:130`).** A 204 has nothing to parse, so `undefined` is
returned and cast to `T`; callers of no-body endpoints type them `apiFetch<void>`.

### `frontend/app/lib/cache.ts` — the cache policy, in one place

Three exported constants and a comment explaining what is *not* here. Five
minutes (`cache.ts:18`) applies to clubs and events (`cache.ts:26-27`), each
tagged so a future mutation can `revalidateTag` rather than wait out the TTL.
Nothing revalidates yet — the tags are laid down ahead of the writes that will
need them.

Search is deliberately absent (`cache.ts:30`): its query space is unbounded, so
caching it fills the store with entries nobody asks for twice, and results are
ranked per query rather than being a stable resource.

### `frontend/app/lib/club.tsx` · `event.tsx` — the domain reads

Thin, and deliberately so: build a path, pass a cache policy, map through an
adapter. Two behaviours are worth knowing.

`getClubById` (`club.tsx:42`) and `getEvent` (`event.tsx:33`) return `null` for a
404 and rethrow everything else. `getEvent` also short-circuits a non-numeric id
before making any request, because event ids are database bigints and a slug
cannot name one.

`getTotalEventsForClub` (`club.tsx:75`) counts the club's own events. It
previously returned `Math.floor(Math.random() * 100)`, so the club page printed a
different total on every load.

The comment at `club.tsx:55` marks a deleted function rather than existing code:
`getClubNameById` used to title-case a slug when it could not find a club in mock
data. That guess was right for the seeded clubs only by coincidence.

### `frontend/app/lib/followed-clubs-context.tsx` — the one shared client cache

The only client-side cache in the app, and the only place where *when* to fetch
is a design question. A Follow button cannot know its own label; asking per
button would mean twelve identical requests on a grid of twelve. The list is
fetched once and every button reads from it.

Two deliberate refusals, both documented at the top of the file: it does not
fetch on mount (`requestLoad`, `context.tsx:62`, is called by the consuming hook
at `context.tsx:193`, so a route with no Follow button never asks), and it keeps
whole `Club` objects rather than ids, so `/my-clubs` reads them instead of
fetching the same endpoint a second time.

Writes are optimistic and revert on failure. A *failed* load leaves every button
reading `Follow`, which is the safe direction: following again is idempotent
server-side, whereas a false `Following` offers an unfollow that would do nothing.

### `frontend/app/lib/adapters.ts` — the DTO boundary

Maps `ApiEvent`/`ApiClub`/`ApiMyEvent` onto the UI shapes, and is where nullable
backend fields acquire UI defaults (`Location TBA`, `Free`, a fallback image).
`parseSocialLinks` tolerates malformed JSON by returning an empty record rather
than throwing — the club page renders without social links instead of failing.

### `frontend/app/lib/search.ts` — uncached by design

Both functions call `apiFetch` with no policy, and return early on an empty
query without making a request.

### `backend/.../EventController.java` — the collection filter

`list` (`EventController.java:39`) takes an optional `organizerId` and filters
server-side. Chosen over a nested `/clubs/{id}/events` route; see *Design
decisions*.

### `backend/.../EventRepository.java` — the N+1 fix

Every read attaches `@EntityGraph(attributePaths = "organizer")`. `Event.organizer`
is `LAZY`, which is correct for the write paths, but `EventMapper` reads the
club's *name* for the DTO — and a lazy proxy answers `getId()` from the
identifier while `getName()` must initialize it. **Measured on
`GET /api/v1/events` with 6 events: 13 statements with the graph, 17 without.**

### `backend/.../MyClubController.java` — the me-scoped pattern

The acting user comes from the JWT via `Authentication`, never from a path
variable, so one user cannot read or change another's follows. The file also
records a non-obvious security fact: the `permitAll` entry for
`GET /api/v1/clubs/**` does not reach these routes, because they live under
`/api/v1/users/me` and fall through to `.anyRequest().authenticated()`
(`SecurityFilterChainConfig.java:45-51`).

### `backend/.../DefaultExceptionHandler.java` — status mapping

A `@ControllerAdvice` mapping twelve exception types onto statuses, with a
catch-all `Exception` handler returning 500. *(Re-read 2026-08-15; three
handlers were added by the authentication work.)*

The entries that carry reasoning worth preserving:

- `AccessDeniedException` exists so `@PreAuthorize` denials return 403 rather
  than falling through to the catch-all as 500s.
- `MethodArgumentTypeMismatchException` does the same for a malformed path
  variable ([BUG-024](../../bugs/fixed_bugs.md#bug-024)), and deliberately does
  not echo `e.getMessage()`, which names the target Java type and the controller
  parameter.
- `ConstraintViolationException` → 400, added 2026-08-15. `@Valid` covers request
  bodies only, so a constraint on a `@RequestParam` raises this instead and was
  answering **500** for an ordinary malformed query string
  ([BUG-029](../../bugs/fixed_bugs.md#bug-029)).
- `TooManyAttemptsException` → 429 with `Retry-After`, and
  `EmailNotVerifiedException` → 403. Both from the auth work; see
  [`authentication.md`](authentication.md).

**The catch-all no longer echoes `e.getMessage()`.** It logs the exception at
ERROR and returns a fixed string. Echoing handed internal detail to the caller
for anything unmapped — a JVM helpful-NPE naming a private field is what
prompted the change. The practical consequence for this document: **an unmapped
exception is now opaque to clients by design**, so anything a caller must act on
needs its own handler and its own status rather than relying on the message.

**Every handler has its own name**, as of 2026-08-16. They were thirteen
overloads of `handleException` distinguished only by parameter type. Spring
dispatches on the `@ExceptionHandler` annotation and never on the signature, so
the overloading bought nothing and cost two things: a reader had to match brace
to signature to see which one ran, and a stack trace said `handleException`
thirteen times. CodeQL flagged it as `java/confusing-method-signature`, which was
right for a duller reason than it thought. Two handlers whose message is a fixed
string also dropped their unused exception parameter — legal, because the
annotation already names the type.

**The catch-all scrubs the URI before logging it**
([BUG-033](../../bugs/fixed_bugs.md#bug-033)). `Logs.safe` strips control
characters and bounds the length. The reasoning is in the bug entry; the point
for this document is that **any new log line carrying request data must go
through `Logs`**, and the catch-all is the line that most needs it.

**Undocumented here:** `AuthenticationController`, `UserController`,
`ClubAdminRequestController`, `SearchController` and `MyEventController` are part
of the same API surface but were not read for this document. Auth is covered by
[`authentication.md`](authentication.md); search by [`search.md`](search.md).

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| One `apiFetch` boundary | Base URL, auth headers, error typing and caching each needed doing once, not per call site | Per-module `fetch` calls | Server-side rendering breaks in Docker; the caching guard stops applying |
| Opt-in caching, never on by default | `fetch` is uncached by default in this Next version, so every server render re-queried the backend | Caching everything by default | Per-user data becomes cacheable by accident — the failure the guard exists to prevent |
| Cache policies centralised in `cache.ts` | A TTL repeated at each call site drifts | Literal `revalidate: 300` per call | Changing the TTL means finding every caller |
| Hand-maintained DTO/type pairs | No codegen toolchain exists | OpenAPI generation | Nothing immediate; the drift risk is already live (see gaps) |

### Task-specific

**Refusing to cache authenticated responses (`api.tsx:88`).** Next keys the data
cache on the URL; the bearer token is not part of that key. A cached
authenticated response is therefore not stale data, it is *the wrong user's*
data. The alternative considered was a comment warning against it. Rejected
because the failure is silent — nothing crashes, the wrong name simply appears on
someone else's screen — and a comment does not fail a build. Reverting it
reintroduces a cross-account leak with no symptom. Covered by
`app/__tests__/api.test.ts` (7 tests).

**`null` for 404, throw for everything else.** Any slug can be typed into the
address bar, so a miss is an ordinary outcome of a URL the user chose, while a
500 is a genuine fault the caller cannot render its way out of. The alternative —
returning `null` for both — is what shipped originally and produced *Club not
found* for a backend that was merely down. The split is what lets the page send a
real 404 status rather than a 200 carrying an error message.

**`organizerId` as a filter on `/api/v1/events` rather than a nested route.** The
club dashboard downloaded every event in the system and filtered in the browser.
A nested `/clubs/{id}/events` was rejected as a second route returning the same
representation of the same collection; the filter reuses the existing one. If
reverted, the dashboard's cost grows with the size of the whole events table
rather than with one club's.

**`connection()` rather than `dynamic = 'force-dynamic'` on `/clubs`.** The docs
state `force-dynamic` is equivalent to `fetchCache = 'force-no-store'`, which
would strip the five-minute cache off every read in that tree and silently undo
the work that added it. `connection()` changes only *when* the render happens.
Verified by measurement: three consecutive request-time renders of `/clubs`
produced **one** upstream `GET /api/v1/clubs` through a counting proxy.

**`cacheComponents: true` was considered and rejected.** It makes every dynamic
route stream a static shell first, and a streamed response cannot change its
status — the real 404s would silently degrade to soft ones.

**Demand-driven follow list.** Fetching on mount cost a `/users/me/clubs` request
on every route a signed-in user opened, including the five of seven measured that
have no Follow button on them. The `authLoading` guard
(`followed-clubs-context.tsx:74`) is what prevents a 403 during the initial
`/users/me` round trip; removing it makes the request fire before the user
resolves.

**No backend cache layer.** *Rationale not recorded* — this appears to be
absence rather than a decision. Nothing in the code or the commit history argues
against `@Cacheable`; it was simply never added. Note the Caffeine caches added
2026-08-15 in `security/ratelimit/` are **not** a counter-example: they hold
rate-limit counters, not query results, and nothing reads application data
through them.

**No client query library (TanStack Query and equivalents), deferred not
rejected.** *Decided 2026-08-15.* The obvious targets — clubs, events, detail
pages, search — are already Server Components reading through the Next data
cache, so adopting one there would move rendering off the server to acquire a
cache that already exists. It would be a regression, not an upgrade.

Where it would genuinely pay is the client surface: `followed-clubs-context.tsx`
is roughly two hundred lines hand-rolling exactly what `useQuery` plus
`useMutation` with optimistic rollback provide, four client pages each repeat
`useState(null)` + `useEffect` + an error flag, and `todo.md` has a **second**
bespoke provider queued for saved events.

It is still deferred, because that surface is not fixed yet. **The `localStorage`
JWT is the reason those pages are client-rendered at all** — a Server Component
cannot read the token, so every authenticated page is forced into the browser.
Move auth to a cookie ([BUG-003](../../bugs/bugs.md#bug-003)) and several of them
can become Server Components, which changes what is left to serve. Adopting a
query library first would mean fitting it to a shape about to change.

**Trigger to revisit:** after the cookie migration lands, or sooner if a third
hand-rolled client cache is about to be written — at that point the duplication
outweighs the dependency.

---

## Rules for changing this area

Placement rules, meant to be checkable against a diff. The entry-point bullets at
the top of this document cover the `apiFetch` boundary itself; these cover where
data is allowed to live.

### Do

- Give every new piece of data **one authoritative owner**, and treat every other
  copy as disposable.
- Put anything that must follow a user across devices in **PostgreSQL**.
- Reach for a **Server Component + a policy from `cache.ts`** for public reads.
  It is the cheapest path and already the majority of the app.
- Add new cache policies **to `cache.ts`**, not as a literal `revalidate` at a
  call site.
- Choose a TTL from how fast that resource actually changes. Club descriptions
  and a live event's status do not want the same number.
- Keep authorisation in **Spring Security**. A frontend check is a UI affordance,
  never a boundary.
- Ask *does the server need this before it renders?* before choosing
  `localStorage` — if yes, it is a cookie or it is account data.

### Don't

- **Do not put fetched events, clubs, profiles or search results in
  `localStorage`.** It buys one avoided request and takes on expiry,
  invalidation, cross-tab divergence and a second serialisation format. Nothing
  in the app does this today; keep it that way.
- **Do not combine `auth: true` with `revalidate` or `tags`.** `apiFetch` throws
  (`api.tsx:88`). The throw is the feature.
- **Do not put application data in cookies.** They ride along on matching
  requests, so a cached list there is paid for on every call.
- **Do not treat `localStorage` as a second database**, and do not add a second
  item to it before the JWT has left.
- **Do not add Redis to look production-shaped.** The honest triggers are more
  than one backend instance (which the rate limiter already names), a measured
  database bottleneck, or expensive computed results worth sharing.
- **Do not persist AI planner responses** without a product decision to. The
  prompt survives a redirect in `sessionStorage`; the results do not survive at
  all, on purpose.
- **Do not assume an httpOnly cookie is free.** Moving the JWT there brings CSRF
  into scope, and CSRF is currently disabled — correctly, for a bearer-token API.
  The two changes go together or neither goes.

---

## Known deviations, gaps and blockers

**The JWT is in `localStorage`, and it is the structural constraint here.**
`auth-context.tsx:26` reads it on mount and calls `/api/v1/users/me` before
anything else can proceed. Two consequences: authenticated pages cannot be server
rendered at all, and every one of them pays a sequential round trip before its
own data request starts. It is also an XSS token-theft path. Tracked as
[BUG-003](../../bugs/bugs.md#bug-003); moving to an httpOnly cookie touches every
auth endpoint, `apiFetch`, `AuthProvider` and `ProtectedRoute`, and logs out every
existing session.

**No cache invalidation exists.** `CACHE_TAGS` is defined and passed on every
public read, but nothing calls `revalidateTag`. Creating an event does not evict
the events list — it goes stale for up to five minutes. Acceptable at current
scale, wrong as soon as club admins expect to see their own edits.

**`images` and `categories` are still N+1**, at two statements per event from the
`@ElementCollection` copies in `EventMapper` — 2 of the 13 statements measured
above, times the event count. Pre-dates the `organizerName` work.
[todo.md](../../TODO/todo.md) P3.

**The DTO/type contract is hand-maintained and has already drifted once.** Event
cards derived the organizing club's name by title-casing its slug against mock
data; it agreed with the real name only by coincidence, and never for a club like
*Making Waves Montréal*. Fixed by carrying `organizerName` on `EventDTO`, but
nothing structural prevents the next divergence.

**No HTTP caching on API responses.** No `Cache-Control`, no `ETag` — verified by
grep. Every cache hit today is Next's in-process data cache, which means a second
frontend instance shares nothing with the first.

**No global ceiling on search spend.** The per-IP budget added for
[BUG-005](../../bugs/fixed_bugs.md#bug-005) bounds one caller, not the sum of
them: a thousand IPs each staying under 30/min is still a thousand times the
cost. The honest control is a hard monthly cap on the OpenAI project itself,
which is a dashboard setting rather than code and is tracked in
[`todo.md`](../../TODO/todo.md) under *AI & Search*.

**Rate-limit counters are per instance.** Both the auth and search budgets live
in memory, so they reset on restart and a second backend instance would enforce
its own copy — doubling every effective limit. Accepted while there is one
instance; that is the trigger to move them to Redis.

**Admin and dashboard over-fetch.** Whole lists are pulled for two counts, and
all events for eight. Against 8 clubs and 0 events this is not measurable, and it
is recorded rather than fixed.

**`PingPongController` and `/api/v1/search`** exist in the surface inventory but
were not read for this document.

---

## Possible improvements

Prioritised, each with the trigger for doing it.

1. **Move the JWT to an httpOnly cookie** (P1, blocked on a decision, not on
   work). Unblocks server rendering for authenticated pages, deletes the
   `/users/me` waterfall, and closes the XSS path. Do it with
   [BUG-003](../../bugs/bugs.md#bug-003) rather than separately. **Trigger:** the
   next time signed-in page latency or route protection comes up.
2. **Call `revalidateTag` from the write paths** (P2). The tags already exist,
   but the writes do not go through Next — the create forms are Client
   Components posting straight to Spring Boot, so Next never learns that
   anything changed. Doing this needs a Next Route Handler or Server Action for
   the client to call after a successful write, which is a small piece of
   design rather than a one-liner, and it adds an endpoint that can evict the
   cache. **Trigger:** the first complaint that a new event does not appear, or
   the first real club admin.
3. **Batch the `images`/`categories` collections** (P3) with a batch size or a
   second entity graph. **Trigger:** event count reaching the low hundreds, where
   2n statements start to show.
4. **Generate the frontend types from the backend DTOs** (P3). Would have made
   the `organizerName` drift a compile error. **Trigger:** a second contract
   divergence, or adding a third consumer of the API.
5. **Decide whether the API should send `Cache-Control`** (P3, needs a decision
   first). Only becomes load-bearing behind a CDN or with more than one frontend
   instance. **Trigger:** an actual deployment target existing — there is none
   today.
6. **Reconsider a client query library** (P3, deliberately deferred — see Design
   decisions). Not for the public pages, which are Server Components already.
   For the client surface, where `followed-clubs-context.tsx` and four pages
   hand-roll it. **Trigger:** the cookie migration landing, or a third bespoke
   client cache being about to be written.

---

## Change log

- **2026-08-16** — Acted on the CodeQL findings from
  [PR #31](https://github.com/ArpanSaha07/campus-vibe/pull/31). The one with a
  consequence for this document is
  [BUG-032](../../bugs/fixed_bugs.md#bug-032): the 429 written by the rate-limit
  filters was hand-built JSON carrying three of `ApiError`'s four fields, so the
  error shape this document describes was not in fact uniform across statuses. It
  now goes back through `@ControllerAdvice` and is. Also recorded the handler
  renames and the log scrubbing
  ([BUG-033](../../bugs/fixed_bugs.md#bug-033)). *(main session)*
- **2026-08-15 (b)** — Search spend controls for
  [BUG-005](../../bugs/fixed_bugs.md#bug-005): a per-IP budget on the two public
  search endpoints, a 200-character query cap, and `QueryEmbeddingCache` around
  the provider call. Recorded two limits that came with them and are not fixed —
  no global spend ceiling, and per-instance counters. Also noted why
  `revalidateTag` is not the one-liner it looks like: the write paths do not go
  through Next at all. *(main session)*
- **2026-08-15 (a)** — Added *Storage layers, and what owns what* (the principle,
  the real layer inventory, the shape of the data paths, a placement table and
  the source-of-truth statement) and *Rules for changing this area*. Recorded the
  decision to **defer a client query library** with its trigger, and noted that
  the new Caffeine rate-limit caches are not a data cache. Ideas adapted from a
  generic guidelines note; only the parts true of this codebase were kept —
  its TanStack-for-everything recommendation was rejected on the grounds that
  the pages it names are already server-rendered. Also re-read
  `DefaultExceptionHandler` and corrected the status-mapping section: three
  handlers were added by the authentication work, and the catch-all no longer
  echoes exception messages to callers. *(main session)*
- **2026-08-14** — Created. Documents the API boundary, the caching model
  introduced in `482c4dd`, and the constraints the `localStorage` JWT imposes on
  both. Written after the caching work was verified end-to-end: the guard has
  tests, the `@EntityGraph` saving was measured at 13 statements against 17, and
  the `/clubs` data cache was measured at three renders to one upstream query.
  Records two gaps that are absence rather than decision — no backend cache layer
  and no cache invalidation — and marks the backend-cache rationale as not
  recorded rather than inventing one. *(main session)*
