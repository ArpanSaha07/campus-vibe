# CampusVibe — Bug Log

Last updated: **2026-09-15** · Branch: `develop`

Open issues only. Resolved ones move to [`fixed_bugs.md`](fixed_bugs.md)
(BUG-005, BUG-008 … BUG-017, BUG-019 … BUG-037 — everything not in the table below). Bug ids are never reused.

**Moved to [`fixed_bugs.md`](fixed_bugs.md):** BUG-005, BUG-028 … BUG-031 (2026-08-15) · BUG-032 … BUG-034 (2026-08-16) · BUG-035 (2026-09-03) · BUG-036, BUG-037 (2026-09-05) · BUG-038 (2026-09-08) · BUG-040, BUG-041, BUG-045 … BUG-047 (2026-09-09) · BUG-048, BUG-049 (2026-09-10) · BUG-039, BUG-050 (2026-09-11) · BUG-052, opened and fixed the same day (2026-09-14) · BUG-051, and BUG-054 opened and fixed the same day (2026-09-15) · BUG-006, BUG-043, and BUG-055 and BUG-056 opened and fixed the same day (2026-09-15, club and event management).

**Highest id issued: BUG-056.** Grep *both* files before taking the next one — ids have collided three times. BUG-038 was issued twice, and so was BUG-040: the open production-bucket bug was renumbered BUG-051 on 2026-09-12, since the club-logo crash already holds `fixed_bugs.md#bug-040`.

| ID | Severity | Summary |
|---|---|---|
| [BUG-044](#bug-044) | High | `Club.images` and `Event.images` lose every write if the CodeQL autofix is accepted on them |
| [BUG-042](#bug-042) | Low | Profile avatars have no read path — the events half was fixed 2026-09-12 |
| [BUG-001](#bug-001) | High | Semantic-only search match returns 0 results — **root cause found and fixed 2026-09-14** (weights formatted into SQL under a `fr_CA` locale); open until a GitHub run |
| [BUG-053](#bug-053) | Low | A URL with no handler answers 500 and logs an ERROR stack trace, instead of 404 — `/actuator/env` included |
| [BUG-002](#bug-002) | High | Backend CI runs JDK 17 but the project requires Java 25 |
| [BUG-003](#bug-003) | High | Frontend route protection never executes |
| [BUG-004](#bug-004) | Medium | `NEXT_PUBLIC_*` baked in empty by the frontend Docker build |
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

**Reproducing again, 2026-08-20.** Seen during the full `mvn verify` for the
user-profile backend work, and confirmed the same way: a clean worktree at
`HEAD` (5a48f34) with none of that work applied fails identically — 7 run, 1
failure, `semanticSearchMatchesMeaningWithoutSharedKeywords:167`, collection
size 0. So the 2026-08-08 note that it *does not reproduce* is stale rather than
a fix, and whatever made it pass that day was environmental. It remains the only
failing test in a suite of 229.

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

**⚠️ DOES NOT REPRODUCE as of 2026-08-08 — do not act on this entry without
re-measuring first.** Three runs on the dev machine, all green:

| Run | Result |
|---|---|
| `./mvnw -B verify` (full suite, Boot 3.5.16) | **42/42**, `SearchIT` **7/7** |
| `SearchIT` alone (Boot 3.5.16) | **7/7** |
| `SearchIT` alone at `HEAD` in a worktree (Boot **3.5.5**) | **7/7** |

The third run is the control: `HEAD` differs from the working tree only by the
[BUG-019](fixed_bugs.md#bug-019) parent bump, so **the Spring Boot upgrade is not
what changed this.** Nor is anything else obvious — the search sources have not
changed since 2026-07-30 (`00a0933` touched only a doc path inside a comment),
the rename to `SearchIT` in `88a03b1` changed exactly one line (the class name),
and Testcontainers still uses the same `pgvector/pgvector:pg15` image cached on
2026-07-29. Same code, same database image, same machine — failing 2026-08-05,
passing 2026-08-08. **The cause of the change was not established**, and a bug
that flips without an explanation is not a fixed bug.

One recorded hypothesis can now be ruled *down*: cause 3 (`%f` under a
comma-decimal FORMAT locale) would emit `0,700000 * COALESCE(...)`, which
Postgres parses as two select-list items and then errors on the missing `score`
column — an HTTP 500, which would fail the `status().isOk()` assertion first. The
recorded symptom is a **200 with zero rows**, pointing instead at the embedding
being NULL or unreadable at query time (cause 1): `COALESCE(1 - (...), 0)` scores
a NULL embedding at 0, and `WHERE score >= 0.2 OR kw > 0` then drops it.

**Kept OPEN deliberately.** The arbiter is a full-tier run on GitHub — clean
runner, fresh image pull, Linux — which no push has yet produced. Close it on a
green CI run, not on these local ones.

**Blocks branch protection — probably no longer, but unconfirmed.** The plan on
record was to fix it or annotate **the single method** `@Disabled("BUG-001: …")`
(disabling the whole class would also lose the 6 passing search tests). Do not
apply that annotation now: it would disable a test that currently passes, on the
very run that could finally explain it.

**Passed locally again, 2026-09-12 — twice.** `SearchIT` ran 7 of 7 green in
both full `verify.mjs --all --full` runs of the S3 work, on this machine,
against a fresh `pgvector/pgvector:pg15` container. It had been re-confirmed
reproducing on 2026-09-11 on a clean worktree at `77baaab`. Nothing in the S3
work touches search, so this is the same unexplained flip as 2026-08-08, not a
fix, and the rule above stands: close it on a green GitHub run.

**Root cause found and fixed, 2026-09-14. It was cause 3 after all.** The
2026-08-08 ruling-down above was wrong. `0,700000 * COALESCE(...) + 0,300000 *
(...) AS score` is *valid* SQL: Postgres reads three select-list items, `0`,
`700000 * COALESCE(...) + 0` and `300000 * (...) AS score`. So there is no
missing column and no 500. `score` silently becomes `300000 × keyword rank`,
every meaning-only match scores 0, and the response is a 200 with zero rows,
exactly the recorded symptom. The flips followed which JVM ran the suite, not
the code: this machine's JBR runs a `fr_CA` FORMAT locale, and the Linux
container and a GitHub runner never do.

Proven in the test itself with temporary diagnostics, since removed. The event's
embedding was present, the cosine was 0.7746 as computed, the date was in the
future, and `hybridSearchEventIds` still returned `[]`. Under this JBR, `%f`
applied to `0.7` prints `0,700000`.

**Fix:**
- The weights are bound as `?` parameters in both hybrid queries of
  `SearchRepository`.
- `SearchIT.semanticSearchSurvivesACommaDecimalLocale` forces `fr_CA`, so an
  en_US runner still catches a regression.
- The test JVMs are pinned to en_US and UTC in `backend/pom.xml`, and the runtime
  JVM in `backend/Dockerfile`.
- The traps are recorded in `rules/backend-java.md` and `rules/ci-and-build.md`.

`SearchIT` ran 10 of 10 in `verify.mjs --full`, 290 integration tests green.

**Still OPEN, by this entry's own rule.** Close it on a green GitHub full-tier
run and move it to `fixed_bugs.md` then.

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

---

### BUG-044
**`Club.images` and `Event.images` lose every write if the CodeQL autofix is accepted** · High · OPEN

*Renumbered twice, and the second time for the same reason as the first. It was BUG-023 until 2026-09-06, when that id turned out to be taken by the event-detail-page bug in [`fixed_bugs.md`](fixed_bugs.md#bug-023); it became BUG-038, and on 2026-09-08 the Docker smoke-test bug was filed as BUG-038 too. Renumbered to 044 on 2026-09-09. The open entry moves rather than the fixed one, so historical records in `tasks-completed.md` and the `STATUS.md` shipped log keep the id they were written with. **Before filing a bug, grep both files for the next free id** — the highest id in either, not the highest in one.*

**Found:** 2026-08-13, while fixing [BUG-022](fixed_bugs.md#bug-022) on PR #27. That
bug is this one, already detonated, on a different entity.

**Symptom:** none yet — this is a **latent** bug, armed and waiting for a click.
Both entities hand out a live Hibernate collection and both are mutated through
the getter:

```java
club.getImages().addAll(keys);    // ClubService.java:77
event.getImages().addAll(keys);   // EventService.java:57
```

CodeQL has an open `java/internal-representation-exposure` alert on each
(**alert 14** on `Club.java:44`, **alert 15** on `Event.java:48`). Copilot Autofix
offers the same one-click fix it offered for `User.savedEventIds`: replace the
getter with `return new ArrayList<>(images);`. Accepting it makes `addAll` land on
a throwaway list. Uploaded club logos and event banners would then be written to
S3, get their keys computed, and **never reach the database** — no exception, no
log line, and no failing test, because neither service has one covering the image
path.

**Why it is High rather than a note.** The CodeQL alert itself is `severity: note`
with **no security-severity score at all** — it is a code-quality query that
happens to surface in the Security tab. The severity here is not the alert; it is
that the *remedy on offer* silently destroys data, and the alert's presence is
what makes someone click it. [BUG-022](fixed_bugs.md#bug-022) is the proof: the
identical fix was accepted on 2026-08-13 and broke saving events for a day.

**Do not accept Copilot Autofix on alerts 14 and 15.** Apply the pattern already
used in `User.java` instead:

```java
@Getter(AccessLevel.NONE)
@Setter(AccessLevel.NONE)
private List<String> images = new ArrayList<>();

public List<String> getImages() {
    return Collections.unmodifiableList(images);   // wraps the live PersistentBag
}

public void addImages(List<String> keys) {
    images.addAll(keys);
}
```

An unmodifiable view keeps Hibernate's dirty checking intact — it wraps the live
`PersistentBag` rather than replacing it — while turning `getImages().add(...)`
into a loud `UnsupportedOperationException` instead of a silent no-op. Reads at
the DTO boundary already copy (`ClubMapper.java:21`, `EventMapper.java:23` both
call `List.copyOf`), so those callers are unaffected.

**Add a test with the fix** — the reason BUG-022 was caught in an hour and this
one is still theoretical is that `MyEventsIT` covered saving and nothing covers
image upload. `UserTest` (`backend/src/test/java/com/campusvibe/user/UserTest.java`)
is the template: assert the getter throws on mutation, and assert it reflects a
later `addImages` call, which is what pins it as a view rather than a copy.

**Affected files**
- `backend/src/main/java/com/campusvibe/club/Club.java:41-44` (`images`)
- `backend/src/main/java/com/campusvibe/event/Event.java:45-48` (`images`)
- `backend/src/main/java/com/campusvibe/club/ClubService.java:77`
- `backend/src/main/java/com/campusvibe/event/EventService.java:57`
- Reference implementation: `backend/src/main/java/com/campusvibe/user/User.java`

**Affected tests:** none exist for either image path — that is the gap.
`Event.categories` is safe by luck: `EventController.java:61` reassigns via
`setCategories(...)` rather than mutating, though it inherits the same trap the
moment anyone writes `getCategories().add(...)`.


---

### BUG-042
**Event banners and profile avatars have no read path** · ~~Medium~~ Low · OPEN — **events fixed 2026-09-12; avatars remain**

**Found:** 2026-09-09, while building the club media read path for
[BUG-040](fixed_bugs.md#bug-040).

`EventController` stores an S3 object key in `events.images` exactly as
`ClubController` did for `clubs.logo`, and `ProfileAvatar` notes there is no
upload anywhere for avatars. Clubs now have `GET /clubs/{id}/logo` and
`/images/{index}`; **events and avatars have nothing**, so an uploaded event
banner could never be displayed.

Latent today for the same reason BUG-040 was latent until this week: no UI
uploads an event image yet (the unwired `POST /events/{id}/images` is the P2
under Frontend / Features). It stops being latent the moment that is wired.

**The shape when it is built** is the club one, and should not be reinvented:
index addressing so no caller names an object key, raster-only content types
with `nosniff` so an uploaded SVG cannot execute, and the same `/media/**`
rewrite. Replacing all of it with presigned or CDN URLs is an ADR, not a
per-feature choice — see [`s3-media/SKILL.md`](../skills/s3-media/SKILL.md).

**Update 2026-09-12:** an uploaded event banner now reaches a real bucket —
MinIO locally, `campusvibe-prod-media` in production — under
`events/{id}/banners/{uuid}.{ext}`, verified on the compose stack. Nothing
serves it back, so this bug is unchanged, and one step more reachable
([ADR-011](../docs/decisions/ADR-011-minio-replaces-fakes3.md),
[ADR-012](../docs/decisions/ADR-012-one-media-bucket-with-prefixes.md)).

**Update 2026-09-12, later:** worse than a missing read path. `adapters.ts:65`
passes `events.images` through untouched, so an uploaded key reaches
`next/image` at `events/[eventId]/page.tsx:88`, `EventCard.tsx:31` and
`MyEventCard.tsx:31` and throws during render — the BUG-040 crash, for events.
**The events half is specced and approved:**
[`specs/2026-09-12-event-images-served-and-eb-upload-limit.md`](../specs/2026-09-12-event-images-served-and-eb-upload-limit.md).
Arpan also ruled that there is no banner prefix: event photos move to
`events/{id}/images/`, and a banner becomes a photo a club asks the platform
owner to feature, queued separately. Avatars stay in this bug.

**Events half fixed 2026-09-12.** `GET /api/v1/events/{id}/images/{index}`
serves an event photo in the club shape — by index, public, streamed — and
`eventImageUrls` in `adapters.ts` maps keys to `/media/events/{id}/images/{index}`
behind a new `next.config.ts` rewrite. The response itself, with its raster-only
content types and `nosniff`, now lives once in `s3/StoredImageResponses` for
clubs and events alike. Verified by `EventMediaIT` and `adapters.test.ts`, and
on a compose stack: upload, read back byte-identical through the API and the
rewrite, and the event page rendering the `/media` path with no raw key. Kept
open, downgraded to Low, for **profile avatars**, which still have no upload,
column or read path.

---

### BUG-053
**A URL with no handler answers 500 and logs an ERROR stack trace, instead of 404** · Low · OPEN

**Found:** 2026-09-15, probing the freshly deployed backend at
`https://api.campusvibe-mcgill.com`.

**Symptom.** `GET /actuator/env`, `/actuator/metrics` and
`/actuator/does-not-exist` each answer `500` with
`{"message":"Something went wrong. Please try again.","statusCode":500,…}`.
`/api/v1/nope` answers 403 instead, because `/api/**` is authenticated before
dispatch.

**Cause.** `/actuator/**` is `permitAll` (`SecurityFilterChainConfig.java:90`)
and only `health,info` are exposed (`application.yml:41`). So an unexposed or
unknown path passes security and reaches Spring MVC with no handler.
`NoResourceFoundException` has no `@ExceptionHandler`, and falls to the
catch-all `handleUnexpected` (`DefaultExceptionHandler.java:253`), which logs at
ERROR with the stack trace and returns 500. The same holds for any unmapped path
that security lets through.

**Why it matters, and why it is only Low.** Nothing leaks: the body is the fixed
string BUG-029 introduced, and the exposure ceiling holds. But the service is
public now. Every scanner probing `/actuator/*` writes a stack trace into
CloudWatch at ERROR, which buries a real 500. It also tells a prober the path
exists in some form.

**Why no test caught it.** `ActuatorHealthEndpointTest` asserts that
`/actuator/env` does **not** return 200 (`ActuatorHealthEndpointTest.java:62`),
which a 500 satisfies.

**Fix, not started:** a `NoResourceFoundException` handler answering 404 through
`ApiError`, logged below ERROR. Then tighten the test to expect 404. Queued in
[`todo.md`](../TODO/todo.md).

---

