# CampusVibe — TODO

Last updated: **2026-08-14** · Branch: `feature/my-clubs`

Project knowledge — what the code does and why — lives in
[`.claude/docs/`](../docs/README.md). Read that index before changing a
subsystem; this file is the work queue, not the reasoning.

**Finished work lives in [`tasks-completed.md`](tasks-completed.md)** — it is
not gone, it is filed. Check there before building something that sounds like
it may already exist. A digest of the last ten items is at the foot of this
file, so *what just shipped* is answerable without opening it.

Priorities: **P0** blocking / broken · **P1** next up · **P2** planned · **P3** backlog
Bug references point at [`bugs.md`](../bugs/bugs.md) (open) and
[`fixed_bugs.md`](../bugs/fixed_bugs.md) (resolved).

---

## Next up (in order)

1. **Commit the secrets-management work** — Steps 1-5 are complete and verified. See [Recently completed](tasks-completed.md#completed-work-log).
2. **P0** — Fix backend CI: JDK 17 → 25, and stop skipping tests ([BUG-002](../bugs/bugs.md#bug-002)).
3. **P0** — Fix semantic search returning 0 results ([BUG-001](../bugs/bugs.md#bug-001)).
4. **P1** — Step 6 of the LLM key work: query-embedding cache + rate limiting ([BUG-005](../bugs/bugs.md#bug-005)).
5. **P1** — Decide JWT transport (localStorage vs httpOnly cookie) and fix route protection ([BUG-003](../bugs/bugs.md#bug-003)).
6. **P1** — [`dev` profile → admin bootstrap](#database-lifecycle--seeding), in that order. Small, and together they unblock `/search/reindex` and the whole Admin Dashboard track.

---

## P0 — Blocking

- [ ] **Backend CI cannot pass — fix written, never executed.** `backend-ci.yml` set up JDK 17 while the project needs Java 25, and ran `-DskipTests`, so no backend test had ever run in CI — which is why a non-compiling merge and a failing search test both slipped through. **The workflow was rewritten** (`_backend.yml`: JDK 25, `./mvnw -B verify`, never `-DskipTests`). **Left open deliberately: no workflow in this repo has run on GitHub yet**, so the fix is unverified and [BUG-002](../bugs/bugs.md#bug-002) is still OPEN. Close both on a green run, not on the diff.
- [ ] **Semantic search returns nothing for meaning-only matches.** Pre-existing; 1 of 40 tests failing. Embedding *writes* are proven fine, so the fault is in `SearchRepository.hybridSearchEventIds`. ([BUG-001](../bugs/bugs.md#bug-001))

---

## Backend / Features

- [ ] **P1** Add `EventService.update(...)` — there is currently no update path at all, so events can never be edited, and their embeddings go stale. Mirror `ClubService.update`, which correctly re-indexes. ([BUG-006](../bugs/bugs.md#bug-006))
- [ ] **P1** Finish the authentication workflow (listed as *In Progress* in `claude.md`): passwordless email-code login, persistent login.
- [ ] **P1** Apply the `User.java` collection pattern to `Club.images` and `Event.images` — unmodifiable view plus an `addImages` mutator — and add the tests neither path has. **Do not accept Copilot Autofix on CodeQL alerts 14 and 15**: it returns a copy, which detaches `getImages().addAll(keys)` from Hibernate and loses every uploaded logo and banner silently. That exact fix already broke saving events for a day ([BUG-022](../bugs/fixed_bugs.md#bug-022)). ([BUG-023](../bugs/bugs.md#bug-023))
- [ ] **P2** Club Dashboard API: create / edit / delete events for the admin's own club; banner and logo upload.
- [ ] **P2** Admin Dashboard API: create clubs, assign Club Admins, manage users, moderate events.
- [ ] **P3** Notifications.
- [ ] **P3** Ticket purchasing flow.
- [ ] **P3** Move `application-test.yml` from `src/main/resources` to `src/test/resources` so test config stops shipping in the production jar. ([BUG-007](../bugs/bugs.md#bug-007))

## Frontend / Features

- [ ] **P1** Fix route protection — `proxy.tsx` is never executed by Next.js (wrong filename *and* wrong export name), and it reads a cookie while the JWT lives in localStorage. Decide the token transport first; a half-wired guard is worse than none. ([BUG-003](../bugs/bugs.md#bug-003))
- [ ] **P2** Fix `NEXT_PUBLIC_*` in the **production** Docker build — values are inlined at build time, so the deployed frontend ships them empty. Needs `ARG`/`ENV` before `npm run build` plus compose `build.args`. No longer affects local dev, which now builds the `dev` stage and reads them at runtime. ([BUG-004](../bugs/bugs.md#bug-004))
- [ ] **P0** Build password reset, or take the screen down. `RecoverPasswordView` tells the user *we sent you a secure link* and sends nothing — `AuthenticationController` has login/register/google only, with no reset-token table and no mail sender. This was a deliberate call to build the UI ahead of the backend, but it is a promise the product currently breaks. Needs: a `password_reset_tokens` migration (single-use, hashed, ~1h expiry), a mail sender, `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password`, then swap the marked TODO in `RecoverPasswordView.tsx` for the real call. Reset must answer identically for unknown addresses so it cannot be used to enumerate accounts.
- [ ] **P2** Converge the two Google sign-in implementations. `GoogleAuthButton` (auth modal, custom-styled, forwards to a hidden GIS button) and `OAuthButtons` (the `/login` page, Google's own rendered button) now both call `initialize`, and GIS keeps only the last config registered. They never mount together today, so nothing is broken — but the `/login` page should adopt `GoogleAuthButton` and `OAuthButtons` should go.
- [ ] **P3** Point the remaining `/login` links at the auth modal. The Footer's Sign up / Log in and `ProtectedRoute`'s redirect still navigate to the `/login` page, so the app has two different-looking ways to sign in. The navbar and the save-event heart already open the modal.
- [ ] **P1** Add an "I'm going" control so users can actually RSVP. `POST`/`DELETE /api/v1/users/me/rsvps` are live and tested, but nothing in the UI calls them yet, so the Going tab can only be populated through the API. Natural home is the event detail page, beside the existing save heart.
- [ ] **P2** Refresh the My events list after the heart is toggled. `EventLikeButton` updates its own state optimistically, so un-saving on the Saved tab leaves the card visible until reload.
- [ ] **P2** Give `EventInstance` a real end time. `buildGoogleCalendarUrl` currently assumes every event runs two hours, because Google needs a start/end pair and the model has no end. Every "Add to calendar" link is that guess until the backend carries one.
- [ ] **P3** Whole-list calendar export ("Add to calendar" for a full tab). Needs an .ics feed — a Google template link carries exactly one event, which is why that control lives on each card rather than in the page header.
- [ ] **P2** Category filtering on the events listing.
- [ ] **P2** Wire Club Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Wire Admin Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Bookmark UI. `EventLikeButton` posts to `/saved-events` but starts from `initiallySaved={false}` unless the caller knows better, so a saved event still shows an empty heart on the events listing. Same fix as the follow button: a provider holding the saved ids, filled from `GET /api/v1/users/me/events`.
- [ ] **P3** Show the live follower count on club cards and the club page. `Club.followers` is accurate now that follows move it, but `ClubCard` has its count commented out and the club page's number never refreshes after a follow — the provider only tracks ids.
- [ ] **P3** Custom header style in `layout.tsx`. *(from `frontend/README.md`)*
- [ ] **P3** Apply `EventCard`'s stretched-link pattern to `MyEventCard`. Only its stub content links to the event, so the image and padding are still dead. Same fix: `relative` root, `after:absolute after:inset-0` on the title `<Link>`, and the heart/calendar controls lifted above it — they cannot be nested inside the `<a>`.
- [ ] **P3** Stop event cards overlapping in the event section. *(from `frontend/README.md`)*
- [ ] **P3** Restrict club title input to alphanumeric + spaces on create. *(from `frontend/README.md`)*
- [ ] **P3** `images` and `categories` are still N+1 on the events list — two statements per event, from the `@ElementCollection` copies in `EventMapper`. Pre-dates the `organizerName` work and is the whole remaining per-event cost (2 of the 13 statements above, times the event count). A batch size or a second entity graph would flatten it.
- [ ] **P3** Event detail page still shows a static "Save your spot" button and no recurrence. RSVP wiring is tracked above; recurrence has no field in the model at all, so the old hardcoded "Every week on Sunday" line was dropped rather than faked.

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

- [ ] **P1** **Re-run the full tier and get it green past the Trivy gate.** Ran 2026-08-07: the **frontend image scanned clean**, confirming BUG-016 on GitHub, and the gate then failed on the **backend** — four fixable CRITICALs in `app/app.jar`, all from `spring-boot-starter-parent` 3.5.5 ([BUG-019](../bugs/fixed_bugs.md#bug-019)). Parent bumped to 3.5.16, which is the first 3.5.x carrying both fixes. **Replayed end-to-end locally 2026-08-08** once Docker Desktop was up — fail-fast secret guard, `compose build`/`up`, all three health waits, the API smoke tests, the production frontend image on :3001, and the Trivy gate itself with the same Trivy 0.73.0: **both images 0 fixable CRITICAL, exit 0**. So the gate is no longer the open question; what remains unproven is only that a clean Ubuntu runner agrees. Note the old prediction that it would then **fail on [BUG-001](../bugs/bugs.md#bug-001) no longer holds** — the full suite ran **42/42** here, `SearchIT` included, and that bug no longer reproduces on this machine. It is deliberately still open, because nothing explains why it stopped; this run is the arbiter.
- [ ] **P1** **Triage the nine red dependency PRs.** Nothing tracked them until 2026-08-07. Three fail the **fast** tier and so are genuine breaking majors: `#22` eslint-config-next 16, `#21` eslint 10, `#20` lucide-react 1.28 (`frontend`). Two fail both tiers: `#17` Spring Boot 4.1.0, `#15` maven-minor-patch (`backend`). Four fail only the full tier — `#19`, `#18`, `#16`, `#14` — and are probably BUG-001 rather than the bumps (`devops` to confirm). This is Dependabot's ungrouped-majors design working exactly as intended. **Note `#15` now overlaps [BUG-019](../bugs/fixed_bugs.md#bug-019):** the Spring Boot parent went to 3.5.16 by hand to clear the Trivy gate, so `#15` will rebase down to its remaining six updates — the hard-pinned, BOM-free block (`awssdk:s3`, `commons-io`, `jjwt`, the Google clients) that is the actual reason the maven entry exists.
- [ ] **P0** **BLOCKER — possibly lifted, and that needs confirming before anything is built on it.** Branch protection went on 2026-08-07 and `CI` is a required check, so a single red test makes every PR unmergeable, the nine Dependabot ones included. The measurement on record (2026-08-05, **40 tests, 39 pass**) had `SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords:163` as the one failure. **Re-measured 2026-08-08: `./mvnw -B verify` is 42/42 green** — 16 unit (the 2 actuator cases included) + 26 integration, nothing red anywhere in the full tier. [BUG-001](../bugs/bugs.md#bug-001) no longer reproduces, and a Boot 3.5.5 control run in a worktree rules out the [BUG-019](../bugs/fixed_bugs.md#bug-019) bump as the cause; **why it stopped failing is unknown**. So: do **not** apply the `@Disabled("BUG-001: …")` quarantine that was the fallback plan — it would disable a passing test and destroy the evidence. Push and read the full tier instead. If it is green there too, this item and BUG-001 both close; if it is red on Ubuntu, that difference is itself the diagnosis.
- [ ] **P2** **Tighten the Trivy gate** in `_docker.yml` once *both* base-image baselines are known. It reports fixable HIGH+CRITICAL and fails only on fixable CRITICAL. **Both baselines are now measured (2026-08-08), and the answer is that the gate cannot move yet.** Frontend prod: **0 fixable HIGH, 0 CRITICAL**. Backend: **0 CRITICAL but 10 fixable HIGH** — `libexpat` and `p11-kit`/`p11-kit-trust` from `eclipse-temurin:25-jdk-alpine` (`os-pkgs`), and in the jar `commons-io` 2.11.0 → 2.14.0 (**our own hard pin**, CVE-2024-47554), `org.postgresql` 42.7.11 → 42.7.12, and five netty artifacts all needing 4.1.136.Final. Full table in [BUG-019](../bugs/fixed_bugs.md#bug-019). Three things to do before the gate tightens, in this order: **(a)** establish whether the S3 client in use is synchronous — `dependency:tree` shows every netty artifact entering via `awssdk:s3` → `netty-nio-client`, the *async* transport, so if nothing calls it an `<exclusion>` deletes six of the ten findings rather than chasing versions; **(b)** bump `commons-io`, which is ours alone and years stale; **(c)** re-measure, then decide whether the base-image HIGHs have a published fix. Only then flip `--severity CRITICAL` to `HIGH`.
- [ ] **P1** **Record and decide on the Vercel deployment ([BUG-018](../bugs/bugs.md#bug-018)).** Discovered 2026-08-07 only because a preview build failed. Three things, in order: write a `vercel.json` so the root directory and build command are in version control rather than the dashboard; list which `NEXT_PUBLIC_*` keys are set in which Vercel environments (**key names in the docs, never values**); and decide whether the Vercel check should be a required status check on `main` alongside `CI` — if a failed deploy should block a merge, requiring it is the only thing that makes that true. Also worth asking whether preview deployments should exist yet at all: they build against no backend, so a preview is a frontend shell pointed at nothing.
- [ ] **P1** **Fix [BUG-004](../bugs/bugs.md#bug-004) — `NEXT_PUBLIC_*` build args.** Note this is now a **Docker-only** bug: on Vercel these come from project environment variables and are probably correct, so fixing one does nothing for the other ([BUG-018](../bugs/bugs.md#bug-018)). Promoted from P2 on 2026-08-07: `_docker.yml` now builds *and boots* the production image on every full-tier run, so CI is actively producing an artifact with an empty API URL and an empty Google client id. The smoke test only asks for HTTP 200 on `/`, which an empty API URL still returns, so nothing catches it. Two `ARG`/`ENV` lines before `npm run build` in the `builder` stage plus matching `build.args` in compose. BUG-016 rewrote the `runner` stage and deliberately left `builder` alone.
- [ ] **P2** Extend `_database.yml` once the dev seeder lands: assert `DevDataSeeder` does **not** run under the `prod` profile, and that `count(embedding) = count(*)`.
- [ ] **P3** Consider **build-once / promote-one-artifact**. `_docker.yml` builds its own jar rather than consuming `_backend.yml`'s artifact, because `needs: backend` would serialise the jobs and break on a frontend-only PR. The clean fix needs a registry, so it belongs with CD.
- [ ] **P1** **CD prerequisites — none of these exist yet, which is why CD was scoped out** ([BUG-008](../bugs/fixed_bugs.md#bug-008) closed by deleting the stub rather than filling it in). All four are needed before a deploy workflow is worth writing:
  1. An AWS account and an Elastic Beanstalk environment (`docker/Dockerrun.aws.json` still carries the literal `<your-backend-image>:latest` placeholder).
  2. A GitHub OIDC role + trust policy — see the next item.
  3. A registry decision: GHCR or ECR.
  4. A Vercel project + deploy token, if the frontend goes there rather than to EB.
- [ ] **P1** Use **GitHub OIDC** (`aws-actions/configure-aws-credentials` with `role-to-assume`) for AWS auth in CI. Do not add long-lived `AWS_ACCESS_KEY_ID` repo secrets. No LLM key should ever enter CI.
- [ ] **P2** First Elastic Beanstalk deployment — follow [`docker/EB-DEPLOYMENT.md`](../../docker/EB-DEPLOYMENT.md) for the environment-property list.
- [ ] **P2** Attach an IAM instance role granting S3 access, so the default credential chain resolves in production (`s3/S3Config.java` already expects this).
- [ ] **P3** Migrate secrets from EB environment properties to **AWS Secrets Manager** as the app grows. Reachable via `spring-cloud-aws-starter-secrets-manager` + `spring.config.import` with **no feature-code changes** — that is the point of routing everything through `OpenAiProperties` and placeholders now.

## Security

- [ ] **P1** Decide JWT transport. `.claude/claude.md` calls for "persistent login using secure cookies", but the token is in `localStorage` (`app/lib/api.tsx:3`). httpOnly cookies would enable server-side route protection *and* remove an XSS token-theft path. ([BUG-003](../bugs/bugs.md#bug-003))
- [ ] **P2** Authorisation review for the Club Dashboard and Admin Dashboard endpoints as they are built — enforce server-side, never rely on UI restrictions.
- [ ] **P2** Rotate the local dev `JWT_SECRET` before any real deployment, and use a *different* value in production.

## Docs

- [x] **P2** ~~Make doc staleness visible instead of relying on memory~~ — **done 2026-08-14.** `scripts/docs-map.json` maps code paths to architecture docs; `scripts/check-docs.mjs` reports any area that changed without its doc changing, plus how many commits each doc's `**Code as of:**` stamp is behind. Wired into `.githooks/pre-push` as a **notice, never a block** — a stale doc does not break the build, and a blocking check would only teach us to reach for `--no-verify`, which also skips the tests. The four docs that have never been reconciled with the code are stamped `never` rather than given a sha, so the report stays signal.
- [x] **P3** ~~Root `README.md` claims infrastructure that does not exist~~ — **done 2026-08-14.** It listed Playwright, Prettier and Webpack (none in the manifests) and a live Vercel + Elastic Beanstalk deployment (CI deploys nothing). Split into **Built and working** and **Planned**, with a status line saying nothing is deployed yet. It is the public pitch, a different audience from `.claude/docs/` — conflating the two is why it drifted.
- [ ] **P3** **Five links point at `.claude/team/`, which does not exist.** `CHARTER.md`, `ROSTER.md`, `ROUTINES.md`, `WORKING-AGREEMENT.md` and `../commands/ask.md` are referenced from the *Agentic team* entries. Pre-existing — they were already broken in the committed file, not introduced by the todo/completed split. Either the folder was never committed or it was removed; decide which, then restore it or drop the references.
- [ ] **P2** **Call `revalidateTag` from the write paths.** The tags already exist, so this is small. Today, creating an event does not evict the events list — it stays stale for up to five minutes. Trigger: the first real club admin, or the first complaint that a new event does not appear.
- [ ] **P3** **Add a row for [`ai-planner.md`](../docs/architecture/ai-planner.md) to the docs index.** The file exists but is absent from `docs/README.md`, so nothing points at it. Left undescribed rather than guessed at from the filename.
- [ ] **P1** **Re-verify [`user-roles.md`](../docs/architecture/user-roles.md) against the code** and split it into a spec and an as-built description. Highest priority of the three backfills because four source files cite it as the authority for RBAC, so a drifted claim there propagates. Owner: `backend`, reviewed by `security`.
- [ ] **P2** **Rewrite [`authentication.md`](../docs/architecture/authentication.md)** to the [`implementation-docs`](../skills/implementation-docs/SKILL.md) standard. It currently describes endpoints as *Required* rather than existing, so it reads as a plan. Blocked in part on [BUG-003](../bugs/bugs.md#bug-003) — the JWT transport decision should be an ADR first, then the doc describes what shipped.
- [ ] **P2** **Rewrite [`search.md`](../docs/architecture/search.md)** against `com.campusvibe.search`. Keep the existing design note as the rejected-alternatives record. Best done *after* [BUG-001](../bugs/bugs.md#bug-001) is fixed, so the doc describes working behaviour rather than a bug.
- [ ] **P2** **Write the Docker development environment doc** — `docs/architecture/docker-environment.md`. Nothing records why the frontend image has a `dev` stage, why backend watch uses `sync+restart` on the jar rather than `rebuild`, or why the `db` watch rule is near-inert. That reasoning currently survives only in [BUG-013](../bugs/fixed_bugs.md#bug-013) and in compose comments.
- [ ] **P3** **Verify [`llm-api-key-management.md`](../docs/architecture/llm-api-key-management.md)** against the shipped `com.campusvibe.ai` package and add the standard sections.
- [ ] **P3** Update the root `README.md` — it claims a Vercel + Elastic Beanstalk CI/CD pipeline that does not exist yet.
- [ ] **P3** Update the *Current Progress* section of `.claude/claude.md` once the secrets work is committed.
- [ ] **P3** Delete the empty `CLAUDE.md` at the repo root — created accidentally by `/memory`, 0 bytes, untracked. The real project instructions are `.claude/claude.md`.

---

## Agentic team

Charter and rules: [`.claude/team/CHARTER.md`](../team/CHARTER.md) ·
[`ROSTER.md`](../team/ROSTER.md) ·
[`WORKING-AGREEMENT.md`](../team/WORKING-AGREEMENT.md)

- [ ] **P1** **Verify the team after restarting Claude Code.** `.claude/agents/` is scanned at session start, so nine of the twelve have never run. Checks: `/ask ai-eng "why does BUG-001 return zero results?"` cites real `file:line`; a follow-up `/ask` continues the *same* agent rather than cold-starting; `staff-eng` returns `REQUEST-CHANGES` or `BLOCK` on a deliberately flawed patch; each agent refuses work outside its charter and names the right owner.
- [ ] **P1** **Commit and push the team, then create the two routines.** Cloud routines clone the GitHub repo, so `main` must contain `.claude/team/` and `.claude/agents/` or they fail on first run. Then confirm the Claude GitHub App can reach the repo (`/web-setup`), decide whether the digest routine may open a PR, and create both from the prompts in [`ROUTINES.md`](../team/ROUTINES.md).
- [ ] **P2** **Run one real `/kickoff` before trusting the process** — the JWT transport decision (BUG-003) is the natural candidate: architectural, currently blocking, and it should end in the first ADR. Judge the cost against the value before making it routine.
- [ ] **P3** **Reconsider the Opus/Sonnet split after that kickoff.** Seven of twelve are Opus, and a full kickoff spawns six-plus agents. `pm`, `design` and `sparring` are the ones to re-examine first.

---

---

## Recently shipped

The last ten, one line each. Full write-ups, and everything older, in
[`tasks-completed.md`](tasks-completed.md).

| Date | What landed |
|---|---|
| 2026-08-14 | Old `/login` page and its components deleted; auth is the modal only, reached via `/?auth=<view>` |
| 2026-08-14 | Google sign-in switched on — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` was the only gap |
| 2026-08-14 | Local CI parity — `scripts/verify.mjs` + `.githooks/pre-push`, proven to catch the real failure |
| 2026-08-14 | [`api-and-caching.md`](../docs/architecture/api-and-caching.md) — the API boundary and cache model written up |
| 2026-08-14 | Two CI breaks fixed ([BUG-026](../bugs/fixed_bugs.md#bug-026), [BUG-027](../bugs/fixed_bugs.md#bug-027)) and the locale bug ([BUG-025](../bugs/fixed_bugs.md#bug-025)) |
| 2026-08-13 | Duplicate and over-fetching API calls cut; public reads cached 5 min |
| 2026-08-13 | Real 404s for unknown clubs and events ([BUG-022](../bugs/fixed_bugs.md#bug-022), [BUG-023](../bugs/fixed_bugs.md#bug-023), [BUG-024](../bugs/fixed_bugs.md#bug-024)) |
| 2026-08-13 | Club follow / unfollow, wired end to end and verified against the database |
| 2026-08-13 | My clubs page and the shared club logo component |
| 2026-08-12 | Sign-up and login modal |
