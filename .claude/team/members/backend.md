# backend — working memory

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

`backend/src/main/java/com/campusvibe/` — packages: `ai` (+ `client`, `config`),
`auth`, `club`, `clubadmin`, `event`, `exception`, `jwt`, `s3`, `search`,
`security`, `user`.

Migrations: `backend/src/main/resources/db/migrations/` — **plural**, pinned by
`application.yml:26`. V1–V8 applied.

Tests: `ClubPermissionServiceTest`, `JWTUtilTest` (unit, surefire) ·
`AuthenticationFlowIT`, `ClubAdminRequestFlowIT`, `SearchIT` (integration,
failsafe). `./mvnw test` → 14 unit tests, no Spring context, no Docker.
`./mvnw verify` → 40 total.

## Things I have learned about this codebase

- **Unit and integration tests are split by filename**, not by config.
  `maven-failsafe-plugin` is declared in `pom.xml` with **no `<executions>`
  block** — `spring-boot-starter-parent` already binds it. Adding an execution
  runs every IT **twice**. A new integration test must be named `*IT`.
- **The test profile uses H2 with `ddl-auto: create-drop` and
  `flyway.enabled: false`.** Hibernate builds the schema from entities, so my
  migration files are never exercised by the suite. A migration that does not
  match its entity passes every test and fails at boot.
- `application.yml` sets **`ddl-auto: validate`** for the real profile, so a boot
  against a migrated database doubles as an entity/schema drift check.
- **Never edit an applied migration.** Flyway checksums the whole file. See
  [`database-lifecycle`](../../skills/database-lifecycle/SKILL.md).
- `V6__insert_mock_clubs.sql` seeds 8 clubs that **two assertions depend on** —
  `_docker.yml`'s non-empty `/api/v1/clubs` check and
  `SearchIT.clubSearchFindsSeededClubs()`. Moving that seed breaks both, and they
  must move together.
- `JWTUtil` **throws on a blank or <32-byte secret** — deliberate, from BUG-010.
  Do not add a fallback default; that was the bug.
- `ClubService.update` re-indexes the search embedding; `EventService` has **no
  update method at all**, which is [BUG-006](../../bugs/bugs.md#bug-006).
- The OpenAI key path is `docker/.env` or EB environment properties →
  `OpenAiProperties` → `OpenAiEmbeddingClient`. It is **never logged** and the
  `toString` is redacted. A blank key is a supported mode — search falls back to
  keyword-only rather than failing.

## What I tried that did not work

*(empty — record dead ends here so I do not repeat them next session)*

## Open threads

- [BUG-001](../../bugs/bugs.md#bug-001) — `hybridSearchEventIds` returns nothing
  for meaning-only matches. Embedding *writes* are proven fine, so the fault is
  in the query. Owned with `ai-eng`.
