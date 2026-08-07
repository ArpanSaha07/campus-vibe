# CampusVibe — Bug Log

Last updated: **2026-08-07** · Branch: `ci/github-actions`

Open issues only. Resolved ones move to [`fixed_bugs.md`](fixed_bugs.md)
(BUG-008 … BUG-017 so far). Bug ids are never reused.

| ID | Severity | Summary |
|---|---|---|
| [BUG-001](#bug-001) | High | Semantic-only search match returns 0 results |
| [BUG-002](#bug-002) | High | Backend CI runs JDK 17 but the project requires Java 25 |
| [BUG-003](#bug-003) | High | Frontend route protection never executes |
| [BUG-004](#bug-004) | Medium | `NEXT_PUBLIC_*` baked in empty by the frontend Docker build |
| [BUG-005](#bug-005) | Medium | Unauthenticated search can drive unbounded OpenAI spend |
| [BUG-006](#bug-006) | Low | Events are never re-indexed after an edit |
| [BUG-007](#bug-007) | Low | `application-test.yml` lives in `src/main/resources` |
| [BUG-018](#bug-018) | Medium | Vercel builds and deploys outside CI, with configuration recorded nowhere |

---

### BUG-001
**Semantic-only search match returns 0 results** · High · OPEN

**Found:** 2026-07-30, running the backend test suite during the LLM API key
management work.

**Symptom:** an event that matches a query only by *meaning* (no shared
keywords) is not returned. The test asserts one result and receives zero:

```
java.lang.AssertionError:
Expected: a collection with size <1>
     but: collection size was <0>
```

**This is pre-existing, not caused by the secrets work.** Verified by building a
git worktree at `HEAD` with *only* the duplicate-method fix
([BUG-009](fixed_bugs.md#bug-009)) applied — the identical failure reproduces
(7 run, 1 failure, same assertion).
It also fails when run in isolation, so it is not test-ordering pollution.

**What is ruled out:** embedding *writes* are fine.
`reindexBackfillsMissingEmbeddingsAndRequiresAdmin` passes and asserts
`SELECT count(*) FROM events WHERE embedding IS NOT NULL` equals 1, exercising
the same `SearchIndexService.indexEvent` path. No `Failed to index` warning
appears anywhere in the test log.

**Likely cause:** the hybrid scoring query. With the deterministic test stub the
"AI Networking Night" event should score roughly `0.7 × 0.77 + 0.3 × 0 ≈ 0.54`
against a `search.min-score` of `0.2`, so the `WHERE score >= ? OR kw > 0` gate
should admit it. Worth checking, in order:
1. the cosine expression `1 - (e.embedding <=> CAST(? AS vector))` and whether
   `COALESCE(..., 0)` is masking a NULL embedding at query time;
2. JDBC parameter ordering across the two `CROSS JOIN LATERAL` blocks;
3. `%f` interpolation of the weights via `String.formatted` — this uses the
   default *format* locale, so a comma decimal separator would corrupt the SQL.

**Affected files**
- `backend/src/main/java/com/campusvibe/search/SearchRepository.java` (`hybridSearchEventIds`, lines 38-65 — the prime suspect)
- `backend/src/main/java/com/campusvibe/search/SearchService.java:44-52`
- `backend/src/main/java/com/campusvibe/search/SearchIndexService.java:38-49`

**Affected tests**
- `SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords` — **FAILING**
  (renamed from `SearchIntegrationTest` on `ci/github-actions` so maven-failsafe
  picks it up; it now runs in the PR tier, not on every branch push)
- Remaining 6 tests in that class pass. Note `semanticallyClosestResultRanksFirst`
  passes but does **not** prove semantics work: its query `chess` also matches by
  keyword, so the keyword leg alone satisfies it.

**Current suite state:** 40 tests, 39 pass, this 1 failure. Re-measured
2026-08-05 against the surefire/failsafe split: 14 unit tests + 26 integration
tests, failing at `SearchIT:163`.

**Blocks branch protection.** Once `CI` is a required check on `main`, this one
test makes the branch unmergeable. Either fix it or annotate **the single
method** `@Disabled("BUG-001: …")` — disabling the whole class would also lose
the 6 passing search tests. See `.claude/TODO/todo.md`.

---

### BUG-002
**Backend CI runs JDK 17 but the project requires Java 25** · High · OPEN

**Found:** 2026-07-30, while establishing why a non-compiling `main` had a green
history.

**Symptom (as found):** `.github/workflows/backend-ci.yml:23-27` set up JDK 17, while
`backend/pom.xml:33` declares `<java.version>25</java.version>` and
`backend/Dockerfile:1` uses `eclipse-temurin:25-jdk-alpine`. The build cannot
succeed on 17.

Compounding it, line 33 runs `./mvnw -q -DskipTests package` — **backend tests
never run in CI at all**, which is why [BUG-001](#bug-001) and
[BUG-009](fixed_bugs.md#bug-009) both reached the branch unnoticed.

**Status:** the workflow was rewritten on `ci/github-actions` and `backend-ci.yml`
no longer exists — the backend job now lives in `.github/workflows/_backend.yml`,
which pins JDK 25 and runs `./mvnw -B verify` (never `-DskipTests`). Kept OPEN
only because **no workflow in this repo has ever executed on GitHub**, so the fix
is unverified. Close it once a run is green.

**Affected files**
- `.github/workflows/_backend.yml` (JDK 25, `./mvnw -B verify`) — supersedes the
  deleted `backend-ci.yml`
- `backend/pom.xml:33`, `backend/Dockerfile:1` (the versions CI must match)

**Note for local work:** there is no JDK on `PATH` on the current dev machine and
`JAVA_HOME` is unset. The only installed JDK is IntelliJ's bundled JBR 25.0.3:
`export JAVA_HOME="C:/Program Files/JetBrains/IntelliJ IDEA 2026.2/jbr"`.
Do not pipe `./mvnw` into `tail`/`grep` to check success — the pipeline exit code
comes from the last command, so a failed build reports `0`.

---

### BUG-003
**Frontend route protection never executes** · High · OPEN

**Found:** 2026-07-30, auditing where the JWT is stored during the secrets work.

**Symptom:** protected routes are not actually guarded. Three independent
reasons, each sufficient on its own:

1. **Wrong filename.** The file is `frontend/proxy.tsx`. Next.js only runs
   `middleware.ts` at the project root. Confirmed no `middleware.*` exists
   anywhere under `frontend/`.
2. **Wrong export name.** It exports `export function proxy(request)`; Next.js
   requires an export named `middleware`.
3. **Wrong token source.** Even if it ran, `proxy.tsx:7` reads
   `request.cookies.get('token')`, but the JWT is stored in **localStorage**
   under `cv_jwt` (`app/lib/api.tsx:3,12`). Middleware runs on the server and
   cannot read localStorage, so the check would always redirect.

There is also a `matcher` mismatch: `protectedPaths` lists only `/dashboard`
(line 9) while `config.matcher` covers `/create-event/:path*` too (line 23), so
`/create-event` would invoke the guard but never be treated as protected.

**Re-audit 2026-08-06 — causes 1 and 2 above are probably wrong now.** They were
written against Next.js 15 conventions. The project has since moved to
**Next 16.2**, which renamed the middleware convention from `middleware.ts` to
**`proxy.ts`** — so `frontend/proxy.tsx` may now be the *correct* filename, and a
compiled `middleware.js` does exist under `frontend/.next/server/`, suggesting
Next is picking the file up. The export at `proxy.tsx:6` is a **named** `proxy`;
whether Next 16 wants that or a default export needs confirming against the
Next 16 docs, not assumed.

Cause 3 is unaffected and is on its own sufficient: the guard reads a cookie
while the token is in `localStorage`, which the server cannot read. So the bug is
real and the severity stands — but **anyone fixing this must re-establish which
of the three causes actually applies** rather than working from the list above.
Found while grounding the `frontend` agent definition, which is exactly the class
of stale claim that would otherwise have been repeated with confidence.

**Fix direction:** decide token transport first. Server-side route protection
requires the JWT in an **httpOnly cookie**, which is also what
`.claude/claude.md` calls for ("Persistent login using secure cookies"). Moving
off localStorage additionally removes an XSS token-theft path. If the token stays
in localStorage, delete `proxy.tsx` and guard client-side instead — a half-wired
middleware is worse than none, because it looks like protection exists.

**Affected files**
- `frontend/proxy.tsx` (entire file)
- `frontend/app/lib/api.tsx:3-18` (token storage), `:22-30` (`apiFetch` auth header)
- Backend counterpart if switching to cookies: `com.campusvibe.jwt` / security config

**Affected tests:** none — there is no test covering route protection. Add one
with the fix.

---

### BUG-004
**`NEXT_PUBLIC_*` baked in empty by the frontend Docker build** · Medium · OPEN

**Found:** 2026-07-30, reviewing `docker-compose.yml` during the secrets work.

**Symptom:** `frontend/Dockerfile:7` runs `npm run build` in the builder stage,
before any environment variable is supplied. Next.js inlines `NEXT_PUBLIC_*`
values into the client bundle **at build time**, so they are baked in as empty.
The `environment:` block in `docker-compose.yml` sets them at *runtime*, which is
too late for client-side reads. The containerised frontend therefore falls back
to `http://localhost:8080` (`app/lib/api.tsx:1`) and renders the Google button's
dev fallback (`OAuthButtons.tsx:10`).

**Not a secrets issue** — both values are public by design (an API URL and a
Google *client* id). It is a correctness issue for the containerised frontend.

**Scope narrowed 2026-08-03:** the compose stack now builds the `dev` stage
([BUG-013](fixed_bugs.md#bug-013)), and `next dev` reads `NEXT_PUBLIC_*` from the
environment at runtime rather than inlining them at build time. So local Docker
development no longer hits this. **The bug is unchanged for the production
image** — the `builder`/`runner` path still runs `npm run build` with no values
supplied, so it stays open and must be fixed before deploying.

**Still open after BUG-016 (2026-08-07).** That change rewrote the `runner`
stage around `output: standalone` and now boots the production image in CI, so
the bug is closer to being *observable* — but the `builder` stage still runs
`npm run build` with no values supplied, which is the actual defect. If anything
it matters more now: CI builds and serves that image on every full-tier run, so
whatever it bakes in is what a deployment would ship.

**Fix direction:** pass them as `ARG`/`ENV` before `npm run build` and declare
matching `build.args` in compose.

**Affected files**
- `frontend/Dockerfile` — the `builder` stage
- `docker/docker-compose.yml` (frontend service `environment:` → needs `build.args`)
- `frontend/app/lib/api.tsx:1`, `frontend/app/components/auth-components/OAuthButtons.tsx:10`

---

### BUG-005
**Unauthenticated search can drive unbounded OpenAI spend** · Medium · OPEN

**Found:** 2026-07-30, during the LLM API key management design review.

**Symptom:** `GET /api/v1/events/search` and `/api/v1/clubs/search` are public and
issue **one OpenAI embedding call per request** (`SearchService.java:66`). The
only throttle is a 300 ms client-side debounce
(`frontend/app/components/SearchBar.tsx:10-11`), trivially bypassed by calling
the API directly. There is no server-side rate limit, no query-length cap, and no
cache of query embeddings.

Document embeddings are persisted in pgvector
(`db/migrations/V8__search_embeddings.sql:8-9`), but **query** embeddings are
recomputed on every request, including identical repeat queries.

Keeping search public is a deliberate product decision (unauthenticated users must
be able to browse and search), which is exactly why the compensating controls are
required rather than optional. See `.claude/skills/llm-integration/SKILL.md`
("Rate Limiting and Quotas").

**Mitigated so far:** connect/read timeouts and bounded retries were added in
`ai/client/OpenAiEmbeddingClient.java`, and per-call token usage is now logged, so
spend is at least observable. The rate limit and cache are still missing.

**Affected files**
- `backend/src/main/java/com/campusvibe/search/SearchService.java:44-52, 65-67`
- `backend/src/main/java/com/campusvibe/event/EventController.java:42`, `club/ClubController.java:45`
- `backend/src/main/java/com/campusvibe/ai/client/OpenAiEmbeddingClient.java`

**Affected tests:** none yet. Needs a rate-limit rejection test (expect `429`).

---

### BUG-006
**Events are never re-indexed after an edit** · Low · OPEN

**Found:** 2026-07-30, comparing `EventService` against
[`.claude/docs/architecture/search.md`](../docs/architecture/search.md).

**Symptom:** the design note (lines 150-177) specifies regenerating an event's
embedding when its title, description or category changes. `EventService` indexes
only on `create` (`:45`) and has **no update method at all**, so an edited event
keeps a stale embedding indefinitely. `ClubService.update` does re-index
(`:63`), so the two are inconsistent.

Related: the duplicate-method merge damage ([BUG-009](fixed_bugs.md#bug-009)) removed a
`ClubService.update` variant that omitted the re-index call — the surviving copy
is the correct one.

**Affected files**
- `backend/src/main/java/com/campusvibe/event/EventService.java` (no update path)
- `backend/src/main/java/com/campusvibe/club/ClubService.java:51-65` (correct reference implementation)

**Affected tests:** none. Add one asserting the embedding changes after an update.

---

### BUG-007
**`application-test.yml` lives in `src/main/resources`** · Low · OPEN

**Found:** 2026-07-30, while ensuring tests can never make live billed API calls.

**Symptom:** `backend/src/main/resources/application-test.yml` is a *test* profile
shipped inside the production jar. Because it originally declared no `openai:`
block, it inherited `${OPENAI_API_KEY:}` from `application.yml` — meaning a
developer with `OPENAI_API_KEY` exported would have had non-stubbed integration
tests make **live billed calls**.

**Mitigated, not fixed:** `campusvibe.ai.openai.api-key: ""` and a test-only
`jwt.secret` were added to that file, and `SearchIT` (which
deliberately does not use the `test` profile, because it needs Flyway + pgvector)
now pins both via `@SpringBootTest(properties = …)`. The file should still be
moved to `src/test/resources` so test config cannot ship to production.

**Affected files**
- `backend/src/main/resources/application-test.yml` → should be `backend/src/test/resources/`
- `backend/src/test/java/com/campusvibe/AbstractIntegrationTest.java:22` (`@ActiveProfiles("test")`)
- `backend/src/test/java/com/campusvibe/search/SearchIT.java:51-58`

---

### BUG-018
**Vercel builds and deploys outside CI, with configuration recorded nowhere** · Medium · OPEN

**Found:** 2026-08-07, when a Vercel preview deployment failed on
[BUG-017](fixed_bugs.md#bug-017) — the first evidence in this repository that
Vercel was building it at all.

**Symptom:** there is a second, independent build of the frontend that no file
in this repository describes:

- It is **not** part of `ci.yml`, so it is **not** part of the `ci-success`
  gate. A frontend change can be green in `CI`, satisfy branch protection, and
  still fail to deploy. BUG-017 was exactly that: `CI` had no opinion, and the
  only signal was the Vercel check on the pull request.
- It builds from a **different configuration** than CI does. `next.config.ts`
  now branches on `process.env.VERCEL`, so the two builds no longer produce the
  same output by construction — deliberately, but it means CI cannot prove the
  Vercel build works, and did not.
- **No `vercel.json` and no `.vercel/` exist.** Root directory, build command,
  Node version, and every `NEXT_PUBLIC_*` value live only in the Vercel
  dashboard. The `/vercel/path0/frontend/` path in the failure implies a root
  directory of `frontend`, which is inference, not a record.

**Why this matters beyond the one failure.** The pipeline documentation asserted
*nothing deploys* while a deployment platform had been building every push. Any
agent or contributor reading it would have concluded that a frontend change
could not reach anything outside the repository. That was wrong, and it is the
kind of wrong that gets discovered by shipping.

**It also splits BUG-004 in two.** `NEXT_PUBLIC_*` are inlined at build time.
On Vercel they come from project environment variables and are probably correct;
in the Docker image the `builder` stage passes no build args, so they ship
empty. [BUG-004](#bug-004) is a *Docker* bug specifically, and fixing it does
nothing for Vercel — nor the reverse.

**Fix direction**, in order of value:

1. Record what the Vercel project is actually configured with — root directory,
   build command, Node version, and which `NEXT_PUBLIC_*` keys are set in which
   environments. A `vercel.json` puts the build settings in version control;
   the environment values belong in the docs as a list of key names, never
   values.
2. Decide whether the Vercel check should be a required status check on `main`
   alongside `CI`. If a failed deploy should block a merge, requiring it is the
   only thing that makes that true.
3. Consider whether preview deployments should exist for this project at all
   right now. They build against no backend, so a preview is a frontend shell
   pointed at nothing.

**Affected files**
- `frontend/next.config.ts` — the `process.env.VERCEL` branch
- `.claude/docs/architecture/ci-cd-pipeline.md` — corrected 2026-08-07
- No `vercel.json` exists; that is the gap
