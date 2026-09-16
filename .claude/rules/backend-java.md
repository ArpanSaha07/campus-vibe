---
description: All backend Java — layering, collection exposure, and the traps that have already cost bugs
paths:
  - "backend/src/main/java/**/*.java"
  - "backend/src/test/java/**/*.java"
---

# Backend Java

Kept deliberately short: this loads on every backend Java read.

- **Controller → Service → Repository.** Errors surface through
  `@ControllerAdvice`, never hand-built JSON — interpolating strings into a
  response body is how the 429 shipped broken. (BUG-032)
- **Never hand out a copy of an entity collection.** The pattern is
  `@Getter(AccessLevel.NONE)` plus an unmodifiable view plus an `addX` mutator,
  as in `User.java:59-118`. **Do not accept Copilot Autofix on CodeQL alerts 14
  and 15** (`Club.java:44`, `Event.java:48`): it returns a defensive copy, and
  every write to that copy is then lost. (BUG-044, open)
- **Changed a signature or a record component?** Grep for callers *and* for
  `src/test` before you build. javac stops at the first failing phase, so a
  broken `default-testCompile` hides behind a `default-compile` error and CI
  reports only the first. `./mvnw -B verify -DskipITs` surfaces both. (BUG-036)
- **`JdbcTemplate` inside a JPA transaction cannot see unflushed work.** Flush
  before it runs. (BUG-034)
- **Scrub caller-supplied text through `common/Logs` before logging it.**
  (BUG-033)
- **Bind numbers into SQL as `?` parameters; never format them in with `%f`
  or `formatted`.** Those follow the JVM's FORMAT locale, and this dev
  machine's is `fr_CA`: `0.7` printed as `0,700000`, and Postgres read the
  hybrid score as three select-list columns. It stayed valid SQL, so there was
  no error, just empty search results on some machines and never on a Linux
  runner. `SearchIT.semanticSearchSurvivesACommaDecimalLocale` forces the
  locale. (BUG-001)
- **Never build an S3 key from `getOriginalFilename()`, or from anything else
  the caller wrote — go through `s3/MediaKeys`.** A filename of `../../x` used
  to be a file write anywhere the backend could reach, because the local stand-in
  for S3 joined the key onto a directory. **That stand-in is gone** — MinIO
  replaced it 2026-09-12 (ADR-011) and would have shrugged at the traversal, as
  real S3 always would. So the guard is ours alone now: `MediaKeys.assertSafeKey`,
  enforced on every `S3Service` put, get and delete. Do not remove it on the
  grounds that the store no longer needs it — that is precisely why it is here.
  (BUG-039)
- **Every Spring context needs `aws.s3.bucket` set.** `MediaBucket` is a
  singleton with no default and a blank check, so a context that does not supply
  it fails to start. `application-test.yml` covers the profile; `SearchIT` and
  `SearchRateLimitIT` skip that profile and name it inline, as they already do
  for `jwt.secret`. (ADR-012)
- **MockMvc never applies the multipart size caps.** A test asserting an upload
  limit needs a real port — see `MediaUploadLimitIT`. (BUG-039)
- **Assigned and generated ids make `save()` behave differently** — see
  [`backend-clubs.md`](backend-clubs.md) before touching a club write path.
- **`@Profile("dev")` beans never run under test.** `@ActiveProfiles`
  *replaces* the active set rather than adding to it
  (`skills/database-lifecycle/SKILL.md:38-45`).
- **An error handler a non-JSON request can reach must preset
  `application/json`** — use `json(status, apiError)` in
  `DefaultExceptionHandler`. A negotiated `ApiError` under
  `Accept: text/event-stream` (the planner page's stream request) finds no
  writer and leaves as a bodiless 500. `@ResponseStatus` on an exception only
  hides this, without a body. (BUG-059)
- **A streamed response (`SseEmitter`) needs `DispatcherType.ASYNC` permitted**
  — the first rule in `SecurityFilterChainConfig`. The JWT filter does not run
  on the second, async dispatch, so without it the stream is refused mid-reply.
  **MockMvc does not show this**; only a real port does, as `PlannerStreamIT`
  proves by failing when the line is removed. Set an explicit emitter timeout
  too: Tomcat's default async timeout is 30 seconds.
  ([`ai-planner.md`](../docs/architecture/ai-planner.md))
- **The IT suites need Testcontainers:** `node scripts/verify.mjs --full`.
