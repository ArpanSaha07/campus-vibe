# CampusVibe — TODO

Last updated: **2026-08-03** · Branch: `feature/frontend-ui`

Priorities: **P0** blocking / broken · **P1** next up · **P2** planned · **P3** backlog
Bug references point at [`bugs.md`](../bugs/bugs.md) (open) and
[`fixed_bugs.md`](../bugs/fixed_bugs.md) (resolved).

---

## Next up (in order)

1. **Commit the secrets-management work** — Steps 1-5 are complete and verified. See [Recently completed](#recently-completed).
2. **P0** — Fix backend CI: JDK 17 → 25, and stop skipping tests ([BUG-002](../bugs/bugs.md#bug-002)).
3. **P0** — Fix semantic search returning 0 results ([BUG-001](../bugs/bugs.md#bug-001)).
4. **P1** — Step 6 of the LLM key work: query-embedding cache + rate limiting ([BUG-005](../bugs/bugs.md#bug-005)).
5. **P1** — Decide JWT transport (localStorage vs httpOnly cookie) and fix route protection ([BUG-003](../bugs/bugs.md#bug-003)).
6. **P1** — [`dev` profile → admin bootstrap](#database-lifecycle--seeding), in that order. Small, and together they unblock `/search/reindex` and the whole Admin Dashboard track.

---

## P0 — Blocking

- [x] **Backend CI cannot pass.** `backend-ci.yml` sets up JDK 17; the project needs Java 25. Also runs `-DskipTests`, so no backend test has ever run in CI — which is why a non-compiling merge and a failing search test both slipped through. Fix the JDK, then drop `-DskipTests`. ([BUG-002](../bugs/bugs.md#bug-002)) — **workflow rewritten on `ci/github-actions`; JDK 25 + `./mvnw -B verify`. Unverified until it runs on GitHub, and the first run is expected to fail on BUG-001 (below), which is the correct signal.**
- [ ] **Semantic search returns nothing for meaning-only matches.** Pre-existing; 1 of 40 tests failing. Embedding *writes* are proven fine, so the fault is in `SearchRepository.hybridSearchEventIds`. ([BUG-001](../bugs/bugs.md#bug-001))

---

## Backend / Features

- [ ] **P1** Add `EventService.update(...)` — there is currently no update path at all, so events can never be edited, and their embeddings go stale. Mirror `ClubService.update`, which correctly re-indexes. ([BUG-006](../bugs/bugs.md#bug-006))
- [ ] **P1** Finish the authentication workflow (listed as *In Progress* in `claude.md`): passwordless email-code login, persistent login.
- [ ] **P2** Club Dashboard API: create / edit / delete events for the admin's own club; banner and logo upload.
- [ ] **P2** Admin Dashboard API: create clubs, assign Club Admins, manage users, moderate events.
- [ ] **P2** Bookmark events (entity, migration, endpoints).
- [ ] **P2** Follow clubs (entity, migration, endpoints).
- [ ] **P2** Google Calendar export for an event.
- [ ] **P3** Notifications.
- [ ] **P3** Ticket purchasing flow.
- [ ] **P3** Move `application-test.yml` from `src/main/resources` to `src/test/resources` so test config stops shipping in the production jar. ([BUG-007](../bugs/bugs.md#bug-007))

## Frontend / Features

- [ ] **P1** Fix route protection — `proxy.tsx` is never executed by Next.js (wrong filename *and* wrong export name), and it reads a cookie while the JWT lives in localStorage. Decide the token transport first; a half-wired guard is worse than none. ([BUG-003](../bugs/bugs.md#bug-003))
- [ ] **P2** Fix `NEXT_PUBLIC_*` in the **production** Docker build — values are inlined at build time, so the deployed frontend ships them empty. Needs `ARG`/`ENV` before `npm run build` plus compose `build.args`. No longer affects local dev, which now builds the `dev` stage and reads them at runtime. ([BUG-004](../bugs/bugs.md#bug-004))
- [ ] **P2** Category filtering on the events listing.
- [ ] **P2** Wire Club Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Wire Admin Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Bookmark and follow UI (depends on the backend endpoints above).
- [ ] **P3** Custom header style in `layout.tsx`. *(from `frontend/README.md`)*
- [ ] **P3** Stop event cards overlapping in the event section. *(from `frontend/README.md`)*
- [ ] **P3** Restrict club title input to alphanumeric + spaces on create. *(from `frontend/README.md`)*
- [ ] **P3** Return a proper not-found page for an unknown club URL. *(from `frontend/README.md`)*

## AI & Search

Architecture reference: [`.claude/docs/architecture/llm-api-key-management.md`](../docs/architecture/llm-api-key-management.md) · [`.claude/skills/llm-integration/SKILL.md`](../skills/llm-integration/SKILL.md)

- [ ] **P1** *(Step 6)* Cache query embeddings — Caffeine, bounded + TTL. Highest-leverage cost fix: document embeddings persist in pgvector, but every search re-embeds the query, including identical repeats.
- [ ] **P1** *(Step 6)* Per-IP rate limiting on the search endpoints, returning `429`, enforced **before** the provider call. Required because search is deliberately public. ([BUG-005](../bugs/bugs.md#bug-005))
- [ ] **P1** *(Step 6)* Cap query length before embedding.
- [ ] **P1** *(Step 6)* Set a hard monthly budget cap on the OpenAI project — the only control that bounds the loss from a leaked key. Use **separate OpenAI projects per environment**.
- [ ] **P2** *(Step 6)* Add a `gitleaks` pre-commit hook and enable GitHub secret-scanning push protection.
- [ ] **P3** Introduce `LlmClient` / `PromptTemplateService` / `AIController` — **only when the first generative feature lands**. Embeddings are not generative; SKILL.md says not to scaffold speculatively. The `com.campusvibe.ai` package and `OpenAiProperties` are the foundation these plug into.
- [ ] **P3** Candidate generative features once the layer exists: event summarisation, event description generation, recommendations, moderation assistance.
- [ ] **P3** Multi-provider support (`AnthropicLlmClient`, etc.) — do not add before a feature requires it.

## Database Lifecycle & Seeding

Reference: [`.claude/skills/database-lifecycle/PLAN.md`](../skills/database-lifecycle/PLAN.md) (audit + implementation sequence) · [`SKILL.md`](../skills/database-lifecycle/SKILL.md) (rules)

Ordered — each task unblocks the ones below it. *(Step N)* maps to PLAN.md's
Implementation Sequence.

- [ ] **P1** *(Step 1)* **Create the `dev` profile.** Smallest task here, and it gates every other one: a `@Profile("dev")` seeder written before this exists compiles, deploys, and silently never runs — no error. Add `backend/src/main/resources/application-dev.yml`; add `SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-dev}` to the `backend` service in `docker-compose.yml`; add the var to `docker/.env.example`. Verify the banner logs `The following 1 profile is active: "dev"`, and that `application-test.yml` never pulls it in.
- [ ] **P1** *(Step 2)* **Admin bootstrap runner.** There is currently **no admin account in the system** — the single user holds `ROLE_USER` only. This blocks `POST /api/v1/search/reindex` (`@PreAuthorize("hasRole('ADMIN')")`) and every Admin Dashboard endpoint listed under Backend / Features. Add `bootstrap/BootstrapProperties.java` + `bootstrap/AdminBootstrapRunner.java` as an `ApplicationRunner` — never `@PostConstruct`, which can race Flyway on a cold start. Must support **promote-existing-user** as the primary mode: OAuth accounts have no password to hash. Grant idempotently (`user_roles` PK is `(user_id, role_id)` → `ON CONFLICT DO NOTHING`); never revoke. Add `APP_BOOTSTRAP_ADMIN_{ENABLED,EMAIL,PASSWORD}` to compose, `.env.example` (blank / `false`), and `.env`.
- [ ] **P1** **Backfill club embeddings.** All 8 clubs have `embedding IS NULL`, so the semantic half of club search cannot match anything — only the keyword path works today. A single `POST /api/v1/search/reindex` once an admin exists. Distinct from [BUG-001](../bugs/bugs.md#bug-001) (events, repository-level) but the symptoms look identical, so confirm embeddings are non-null *before* debugging ranking.
- [ ] **P2** *(Step 3)* **Dev seeder** (`seed/DevDataSeeder.java`). `@Profile("dev")`, idempotent — skip when clubs already exist. Port the 8 clubs out of V6 and create them **through the service layer** so `SearchIndexService` populates `clubs.embedding` on write; that is precisely why a programmatic seeder is mandated over seed SQL. Verify with `docker compose down -v && docker compose up -d`, then `count(embedding) = count(*)` on `clubs`.
- [ ] **P2** *(Step 4)* **Retire `V6__insert_mock_clubs.sql`.** Only after the seeder reproduces the same data. Do **not** delete the file — Flyway aborts with `Detected applied migration not resolved locally: 6` and the app will not boot. Supersede it with `V9__remove_mock_club_seed_data.sql`. Locally `docker compose down -v` is cleaner; ship V9 only if V6 ever reached another environment.
- [ ] **P2** **Tests** — migrations apply from an empty schema; bootstrap is idempotent across two runs, promotes an existing non-admin, refuses to create a password-less account, and never revokes; the seeder creates no duplicates and does not run under `test` or `prod`.
- [ ] **P2** *(Step 5)* **Production posture** — before the first EB deploy: `SPRING_PROFILES_ACTIVE=prod` so `DevDataSeeder` cannot run, and `APP_BOOTSTRAP_ADMIN_ENABLED=false` once the admin exists.
- [ ] **P3** **Keep reference data out of schema migrations.** `V7__multi_role_rbac.sql` creates the RBAC tables *and* inserts the three role rows. It is applied, so leave it alone — but split the two concerns in every migration from here on.

## Infrastructure & CI/CD

- [x] **P0** Backend CI JDK + test execution ([BUG-002](../bugs/bugs.md#bug-002)) — also listed above.
- [ ] **P1** **Push `ci/github-actions` and confirm the four workflows go green.** None of them has ever executed on GitHub; everything below assumes a first real run. Expect backend-ci to fail on [BUG-001](../bugs/bugs.md#bug-001) until that is fixed.
- [ ] **P1** **Fix the 5 pre-existing eslint errors** (`no-explicit-any` ×4, `ban-ts-comment` ×1 — see `app/lib/api.tsx`), then delete `continue-on-error: true` from the Lint step in `frontend-ci.yml` so lint actually gates merges. 15 warnings can follow later.
- [ ] **P1** Implement `.ci/build-publish.sh` (currently a 0-byte file) and enable the frontend CD job (`frontend-cd.yml:14` is `if: false`). ([BUG-008](../bugs/bugs.md#bug-008))
- [ ] **P2** Add branch-protection rules on `main` requiring backend-ci, frontend-ci, database-ci and docker-ci to pass. The workflows are only a gate once GitHub enforces them.
- [ ] **P2** Extend `database-ci.yml` once the dev seeder lands: assert `DevDataSeeder` does **not** run under the `prod` profile, and that `count(embedding) = count(*)`.
- [ ] **P1** Use **GitHub OIDC** (`aws-actions/configure-aws-credentials` with `role-to-assume`) for AWS auth in CI. Do not add long-lived `AWS_ACCESS_KEY_ID` repo secrets. No LLM key should ever enter CI.
- [ ] **P2** First Elastic Beanstalk deployment — follow [`docker/EB-DEPLOYMENT.md`](../../docker/EB-DEPLOYMENT.md) for the environment-property list.
- [ ] **P2** Attach an IAM instance role granting S3 access, so the default credential chain resolves in production (`s3/S3Config.java` already expects this).
- [ ] **P3** Migrate secrets from EB environment properties to **AWS Secrets Manager** as the app grows. Reachable via `spring-cloud-aws-starter-secrets-manager` + `spring.config.import` with **no feature-code changes** — that is the point of routing everything through `OpenAiProperties` and placeholders now.

## Security

- [ ] **P1** Decide JWT transport. `.claude/claude.md` calls for "persistent login using secure cookies", but the token is in `localStorage` (`app/lib/api.tsx:3`). httpOnly cookies would enable server-side route protection *and* remove an XSS token-theft path. ([BUG-003](../bugs/bugs.md#bug-003))
- [ ] **P2** Authorisation review for the Club Dashboard and Admin Dashboard endpoints as they are built — enforce server-side, never rely on UI restrictions.
- [ ] **P2** Rotate the local dev `JWT_SECRET` before any real deployment, and use a *different* value in production.

## Docs

- [ ] **P3** Update the root `README.md` — it claims a Vercel + Elastic Beanstalk CI/CD pipeline that does not exist yet.
- [ ] **P3** Update the *Current Progress* section of `.claude/claude.md` once the secrets work is committed.

---

## Recently completed

**2026-08-03 — Working `docker compose watch` for all three services
([BUG-013](../bugs/fixed_bugs.md#bug-013)).** Frontend edits did nothing because
the container served a production build with no compiler watching — the
unaddressed follow-up from [BUG-012](../bugs/fixed_bugs.md#bug-012). Two smaller
faults compounded it: the sync target was one directory too high, and the
`rebuild` path resolved to `docker/package.json`.

- `frontend/Dockerfile` gained a `dev` stage running `next dev` and a shared `deps` stage; `runner` stays last so production builds are unaffected. Compose selects it via `build.target: dev`.
- Per-service watch rules: **frontend** syncs source (no restart), `sync+restart` for `next.config.ts`, `rebuild` for `package.json` / `package-lock.json`; **backend** `sync+restart` on the jar after `mvn package`, avoiding a rebuild that would re-send the whole repo as build context; **db** syncs init scripts, documented as near-inert since the schema is Flyway-owned.
- Verified: `✓ Ready in 746ms`, HTTP 200, and a file copied into the container triggers `✓ Compiled in 108ms` — so inotify works for synced writes and no polling vars are needed.
- Noted while working: `build.context` is the repo root with **no root `.dockerignore`**, so every image build tars up `node_modules`, `target/` and `.git`. Worth adding, but it must not exclude `backend/target/*.jar`, which `backend/Dockerfile` COPYs.

**2026-07-31 — GitHub Actions CI (branch `ci/github-actions`).** Four workflows,
all YAML-validated locally. **None has run on GitHub yet.**

- **`backend-ci.yml`** rewritten — JDK 17 → 25 (matching `pom.xml` and `backend/Dockerfile`), `-DskipTests` dropped for `./mvnw -B verify`, Maven caching, surefire reports uploaded on failure, jar uploaded as an artifact. ([BUG-002](../bugs/bugs.md#bug-002))
- **`frontend-ci.yml`** rewritten — replaced the `npm start &&  sleep 10` step, which asserted nothing and therefore could never fail, with lint + `tsc --noEmit` + Jest + build. Verified locally: type-check clean, **23/23 Jest tests pass**, lint has 5 pre-existing errors so that step is `continue-on-error` for now.
- **`database-ci.yml`** *(new)* — the migrations were previously never executed in CI at all: the backend suite runs on H2 with `ddl-auto: create-drop` and `flyway.enabled: false`, so Hibernate builds the schema from entities and the SQL files are bypassed. Now lints migration filenames/duplicate versions/secrets/emails, then applies all 8 migrations to a clean pgvector database by booting the real jar — which, because `application.yml` sets `ddl-auto: validate`, simultaneously proves the JPA entities still match the migrated schema. A second boot proves idempotency and checksum validity.
- **`docker-ci.yml`** *(new)* — builds the jar first (`backend/Dockerfile` COPYs `target/*.jar` rather than building in-image), then builds both images, starts the stack, waits per-service, and smoke-tests `/ping`, `/api/v1/clubs`, club search, and a 401/403 on a protected route. Also asserts compose still **refuses to start** with no `.env`, guarding the `:?` fail-fast on `POSTGRES_PASSWORD` / `JWT_SECRET` — verified locally against a copy of the compose file.

**2026-07-31 — Postgres healthcheck fix + database-lifecycle standards.**

- `docker-compose.yml` healthcheck ran `pg_isready -U arpan` with no `-d`, so it defaulted the dbname to the *username* and logged `FATAL: database "arpan" does not exist` every 10s. The check still passed — a FATAL reply proves the server is listening — so the container reported `healthy` while spamming errors. Added `-d ${POSTGRES_DB:-campusvibe}`. Verified: 0 FATAL lines across multiple cycles, `db_data` volume and all rows intact.
- `.claude/skills/database-lifecycle/SKILL.md` had **no YAML frontmatter**, so the skill never loaded and none of its rules were ever enforced. Added `name`/`description`, then trimmed 622 → 318 lines (presentation only; no rules dropped).
- Corrected both files against the actual repo: migration path is `db/migrations` (**plural**, pinned by `application.yml:26`) not `db/migration`; dropped the `_FIRST_NAME`/`_LAST_NAME` bootstrap vars that do not map to the single `name` column; rewrote admin bootstrap around **promoting an existing user**, since the create-and-hash flow does not fit OAuth accounts.
- Added rules that were missing: never delete an applied migration (with the exact `Detected applied migration not resolved locally` failure and the four recovery options), derived-column ownership for `clubs.embedding` / `events.embedding`, and a Known Deviations table recording V6, V7, and the absent `dev` profile.
- `PLAN.md` gained a measured Current State audit and a 5-step implementation sequence, each step with its own verification — now tracked under [Database Lifecycle & Seeding](#database-lifecycle--seeding).

**2026-07-30 — LLM API key management (Steps 1-5).** Same build artifact runs
unchanged in local dev (`docker/.env`) and Elastic Beanstalk (environment
properties); only the source of values differs.

- `.gitignore` hardened (`.env`, `.env.*`, `!.env.example`, `*.pem`); `docker/.env.example` committed, `docker/.env` gitignored.
- `docker-compose.yml` restores the `OPENAI_API_KEY` passthrough, with `:?` fail-fast on required secrets and `:-` on the optional OpenAI key.
- New `com.campusvibe.ai` package: `OpenAiProperties` (typed config, redacted `toString`), `AiClientConfig` (explicit connect/read timeouts), `OpenAiEmbeddingClient` (retries 429/5xx only, treats 401 as misconfiguration, logs token usage, never logs the key or provider error bodies). `OpenAiEmbeddingService` is now a thin adapter still implementing `EmbeddingService`.
- Committed JWT fallback and DB password defaults removed; `JWTUtil` fails fast on a blank or <32-byte secret ([BUG-010](../bugs/fixed_bugs.md#bug-010)).
- `Dockerrun.aws.json` converted v2 → v1 so EB environment properties actually reach the container ([BUG-011](../bugs/fixed_bugs.md#bug-011)); `application-prod.yml` and `docker/EB-DEPLOYMENT.md` added.
- Unused `aws-secretsmanager-jdbc` dependency removed.
- Fixed en route: duplicate methods blocking compilation ([BUG-009](../bugs/fixed_bugs.md#bug-009)) and compose bind-mounts hiding the app in both containers ([BUG-012](../bugs/fixed_bugs.md#bug-012)).

**Verified end-to-end:** backend boots with a blank key and logs keyword-only
mode; `/api/v1/clubs/search?q=coding` returns results; compose and the app both
refuse a missing/short `JWT_SECRET`; no secret in the image, image history, git
diff, or tracked files. Suite: **40 tests, 39 pass, 1 pre-existing failure**
([BUG-001](../bugs/bugs.md#bug-001)).
