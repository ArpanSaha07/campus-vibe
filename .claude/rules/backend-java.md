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
- **The IT suites need Testcontainers:** `node scripts/verify.mjs --full`.
