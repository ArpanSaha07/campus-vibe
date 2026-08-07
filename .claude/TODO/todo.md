# CampusVibe — TODO

Last updated: **2026-08-06** · Branch: `agentic-team-creation`

Project knowledge — what the code does and why — lives in
[`.claude/docs/`](../docs/README.md). Read that index before changing a
subsystem; this file is the work queue, not the reasoning.

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
- [x] **P1** ~~Push and confirm `ci.yml` goes green~~ — **done 2026-08-07.** Run `31141549342` on `00a0933` (`agentic-team-creation`): secret scan, frontend, backend, migration lint and the `CI` gate all **passed** in 1m6s. Full write-up: [`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md).
- [ ] **P1** **Run the full tier.** Only the fast tier has executed on this branch — `Docker` and `Database / Apply migrations to a clean database` show `skipped`, which is correct for a branch push. Open a PR to exercise them. The full tier is still **expected to fail on [BUG-001](../bugs/bugs.md#bug-001)**; that is the correct signal, not a pipeline defect.
- [ ] **P1** **Triage the nine red dependency PRs.** Nothing tracked them until 2026-08-07. Three fail the **fast** tier and so are genuine breaking majors: `#22` eslint-config-next 16, `#21` eslint 10, `#20` lucide-react 1.28 (`frontend`). Two fail both tiers: `#17` Spring Boot 4.1.0, `#15` maven-minor-patch (`backend`). Four fail only the full tier — `#19`, `#18`, `#16`, `#14` — and are probably BUG-001 rather than the bumps (`devops` to confirm). This is Dependabot's ungrouped-majors design working exactly as intended.
- [ ] **P1** **BLOCKER — decide BUG-001 before enabling branch protection.** Measured 2026-08-05 with Docker running: `./mvnw verify` is **40 tests, 39 pass**, and the single failure is `SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords:163`. Nothing else in the full tier is red. Once `CI` is a required check that one test makes `main` unmergeable, so either fix [BUG-001](../bugs/bugs.md#bug-001) or quarantine **just that method** with `@Disabled("BUG-001: …")`. Quarantining the whole class would also lose the 6 passing search tests.
- [x] **P1** *(plan Step 5)* ~~Fix the 5 pre-existing eslint errors, then delete `continue-on-error`~~ — **done 2026-08-05.** Note the plan mislocated them: only **2** were in `app/lib/api.tsx`; the other **3** were `no-explicit-any` in `components/auth-components/OAuthButtons.tsx`. Lint now gates merges; 15 warnings remain and do not fail the build.
- [x] **P2** *(plan Step 6)* ~~Add `dependabot.yml` and a standalone `codeql.yml`~~ — **done 2026-08-05.** The repo is **public** (`ArpanSaha07/campus-vibe`), so CodeQL is free; if it is ever made private, code scanning needs GitHub Advanced Security and `codeql.yml` should be deleted rather than left red.
- [ ] **P2** *(plan Step 7)* **Branch protection on `main` — requires repository-settings access, so it cannot be done from the working tree.** Require the single check named **`CI`**, plus "require a pull request" and "require branches to be up to date". **Do not require the component jobs** (`Backend`, `Frontend`, `Database`, `Docker`) — a PR that does not touch a component never starts its job, and the rule then waits forever on "Expected — Waiting for status". That deadlock is the entire reason `ci.yml` exists. Note the check only becomes selectable in the UI **after `ci.yml` has run at least once**, so push first.
- [ ] **P2** **Tighten the Trivy gate** in `_docker.yml` once the base-image baseline is known. It currently reports fixable HIGH+CRITICAL and *fails* only on fixable CRITICAL, so a noisy base image cannot red-line every PR. Move the gate to HIGH after one clean run.
- [ ] **P2** **Add `output: "standalone"` to `frontend/next.config.ts`** and rework the `runner` stage to `COPY .next/standalone` + `.next/static` and run `node server.js`. The production image currently ships the full dev+prod `node_modules` and runs `npm start`. CI now builds and boots this image (`_docker.yml`), so the change is verifiable.
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

- [x] **P2** ~~Document the CI/CD implementation and its design decisions~~ — **done 2026-08-06.** [`.claude/docs/architecture/ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md), written under the new [`implementation-docs`](../skills/implementation-docs/SKILL.md) skill. Update it, do not fork it, when the pipeline changes.
- [x] **P2** ~~Consolidate the knowledge base into one folder~~ — **done 2026-08-06.** [`.claude/docs/README.md`](../docs/README.md) is now the single entry point; implementation docs live in `docs/architecture/`, ADRs in `docs/decisions/`. See [Recently completed](#recently-completed).
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

- [x] **Phase 0** — knowledge base ([`docs/`](../docs/README.md)). Done 2026-08-06.
- [x] **Phase 1** — scaffold + `staff-eng`, `backend`, `frontend` + `/ask`. 2026-08-06.
- [x] **Phase 2** — the other nine agents + their `members/<name>.md`. 2026-08-06.
- [x] **Phase 3** — eight commands: `/kickoff`, `/all-hands`, `/ship-check`, `/design-review`, `/retro`, `/standup`, `/board`, `/digest`. 2026-08-06.
- [x] **Phase 4** — `AUTOMATION.md` switch, [`ROUTINES.md`](../team/ROUTINES.md), `/team`. 2026-08-06. Routine prompts written; **routines deliberately not created yet** — see below.
- [ ] **P1** **Verify the team after restarting Claude Code.** `.claude/agents/` is scanned at session start, so nine of the twelve have never run. Checks: `/ask ai-eng "why does BUG-001 return zero results?"` cites real `file:line`; a follow-up `/ask` continues the *same* agent rather than cold-starting; `staff-eng` returns `REQUEST-CHANGES` or `BLOCK` on a deliberately flawed patch; each agent refuses work outside its charter and names the right owner.
- [ ] **P1** **Commit and push the team, then create the two routines.** Cloud routines clone the GitHub repo, so `main` must contain `.claude/team/` and `.claude/agents/` or they fail on first run. Then confirm the Claude GitHub App can reach the repo (`/web-setup`), decide whether the digest routine may open a PR, and create both from the prompts in [`ROUTINES.md`](../team/ROUTINES.md).
- [ ] **P2** **Run one real `/kickoff` before trusting the process** — the JWT transport decision (BUG-003) is the natural candidate: architectural, currently blocking, and it should end in the first ADR. Judge the cost against the value before making it routine.
- [ ] **P3** **Reconsider the Opus/Sonnet split after that kickoff.** Seven of twelve are Opus, and a full kickoff spawns six-plus agents. `pm`, `design` and `sparring` are the ones to re-examine first.

---

## Recently completed

**2026-08-06 (c) — Agentic team completed, Phases 2–4.**

- **Nine more agents**, each grounded in verified repo facts rather than generic role descriptions: `pm`, `design`, `security`, `sparring` (opus); `devops`, `qa-automation`, `qa-exploratory`, `ai-eng`, `growth` (sonnet). Twelve total, all with a `members/<name>.md`.
- **Eight commands.** `/kickoff` runs four sequential rounds — problem, shape, approach, coherence — and **stops for Arpan before anything is assigned**. `/ship-check` needs five independent signoffs and never softens a `BLOCK`. `/standup`, `/board` and `/digest` spawn **no agents at all**: twelve agents each reporting *nothing since yesterday* costs real money and says nothing, and drift is visible in the files anyway.
- **`WORKING-AGREEMENT.md` gained a ritual cost table** making `/ask` the explicit default. A `/kickoff` for a bug fix spends six agents to reach an answer one would have given.
- **`AUTOMATION.md`** is the pause switch; routines read it first and **fail closed** if it is missing or unparseable — a misfiring unattended routine is worse than one that does nothing.
- **[`ROUTINES.md`](../team/ROUTINES.md)** holds both routine prompts, ready to create. **Deliberately not created:** they run as *cloud* sessions that clone the GitHub repo, and `main` has none of this yet, so they would fail daily and train Arpan to ignore them. Prerequisites and the two options for the digest routine's write access are recorded there.
- **`gh` turned out to be installed and authenticated** (2.97.0, `ArpanSaha07`), contrary to the plan's assumption — so `/team sync` is real rather than degraded. It previews and **requires confirmation before creating any issue**, and refuses to publish an unfixed security finding, because the repository is public.
- **Verified:** 12 agents, 12 member files, 11 commands; every frontmatter `name` matches its filename; every agent named in a command resolves; all relative links resolve.
- **Not verified:** nine agents have never run — `.claude/agents/` is scanned at session start, confirmed by `Agent type 'sparring' not found` after creating it.

**2026-08-06 (b) — Agentic team, Phase 1.** Ad-hoc prompting was producing
unreviewed, disjointed code with nobody holding the whole picture. This is the
scaffold for a standing team that moves work through *discuss → decide → assign →
implement → test → review → ship*.

- **[`team/CHARTER.md`](../team/CHARTER.md)** — read by every agent on every spawn. Product, honest current state, the priority order that breaks ties, and the standing constraints that have already bitten this project.
- **[`ROSTER.md`](../team/ROSTER.md)** — all 12 agents, three built and nine marked planned. Includes the ownership seams where work actually gets dropped, and an escalation ladder ending at Arpan for anything scope-changing, irreversible, or costing money.
- **[`WORKING-AGREEMENT.md`](../team/WORKING-AGREEMENT.md)** — six-point definition of done, the `APPROVE` / `REQUEST-CHANGES` / `BLOCK` vocabulary, the `file:line` evidence standard, and the rule that **a ritual leaving no trace in `git diff .claude/team/` was theatre**.
- **`board/sprint.md`** (in-flight only, every row linking back to `todo.md` or a BUG), **`board/deadlines.md`** (the only file the deadline watcher reads), **`digest/latest.md`** (state of the world, read on spawn).
- **`members/{staff-eng,backend,frontend}.md`** — per-agent memory. Load-bearing, not bookkeeping: agents start cold every spawn, so anything not written here is gone. Pre-seeded with the traps each role keeps hitting.
- **Three agents** in `.claude/agents/`, all Opus: `staff-eng` (read-only reviewer — it may write to nothing but its own member file, because a reviewer that fixes code cannot then review it), `backend`, `frontend`.
- **[`/ask`](../commands/ask.md)** — talk to one teammate. Continues an already-spawned agent via `SendMessage` so follow-ups are a real conversation, and relays the full answer, since agent reports are never shown to the user otherwise.
- **Verified:** structure, frontmatter and every relative link resolve; and every factual claim baked into the agent definitions was spot-checked against the repo — `application.yml:26` migrations path, the deliberately empty `maven-failsafe-plugin` executions block, `application-test.yml:29-31`, and `components/ui/`.
- **Found while grounding the `frontend` agent:** two of BUG-003's three stated causes are probably stale after the Next 16 upgrade. Recorded in [`bugs.md`](../bugs/bugs.md#bug-003).

**2026-08-06 (a) — Knowledge base consolidated into `.claude/docs/`.** Project
knowledge was spread across four loose files at `.claude/` root plus one file in
`docs/` plus one hidden inside a skill folder, with no index — so an agent
starting cold had no way to know what existed. Now one folder, one entry point.

- **[`.claude/docs/README.md`](../docs/README.md)** *(new)* — the index. Every document gets one line stating what it covers and **how far it can be trusted**. Also lists the standards that deliberately live elsewhere (`design-guidelines.md`, the skills), so this stays the single place to start.
- **`docs/architecture/`** holds implementation docs; **`docs/decisions/`** holds ADRs. The split is deliberate: an implementation doc is rewritten whenever the code changes, an ADR is frozen the moment it is accepted. Editing an ADR to reflect a change of mind destroys the only record of what was believed at the time.
- **Moved:** `AUTH_IMPLEMENTATION.md` → `architecture/authentication.md`, `search-implementation.md` → `architecture/search.md`, `user-roles.md` → `architecture/user-roles.md`, `docs/ci-cd-pipeline.md` → `architecture/ci-cd-pipeline.md`, and `skills/llm-integration/llm-api-key-management.md` → `architecture/llm-api-key-management.md`. That last move **fixes two pre-existing broken links** — `todo.md:57` and `frontend/README.md:26` already pointed at `docs/architecture/llm-api-key-management.md`, which did not exist.
- **Four of the five carry a ⚠ banner.** They predate the standard and were not re-verified against the code, so each says exactly what is and is not trustworthy about it. Moving them unlabelled would have been worse than leaving them scattered — an authoritative-looking folder full of unverified claims is how a stale doc gets believed. Rewrites are tracked under [Docs](#docs).
- **`V7__multi_role_rbac.sql:1` and `V8__search_embeddings.sql:1` still cite the old paths, permanently.** Flyway checksums the entire migration file, so editing a single comment in an applied migration triggers `Migration checksum mismatch` on every existing database. Recorded in both docs' banners so the mismatch reads as intentional rather than as an oversight. The four *non-migration* references (`ClubController.java:60`, `JWTUtil.java:49`, `SearchRepository.java:11`, `frontend/app/types/index.ts:45`) were updated.
- **[`implementation-docs`](../skills/implementation-docs/SKILL.md) rewritten** for the agent team: docs now serve two readers, so every doc opens with an *In one paragraph* plain-language summary for Arpan and a *Read this before you change anything here* block for a cold-starting agent. Adds an `Authors` line, makes the implementing agent the writer, and makes `staff-eng` refuse to APPROVE work whose doc omits an open `security` or QA finding.
- **[`adr.md`](../skills/implementation-docs/adr.md)** *(new)* — ADR format, numbering, and the rule that status only moves to `Accepted` when Arpan says so.

**2026-08-03 — Working `docker compose watch` for all three services
([BUG-013](../bugs/fixed_bugs.md#bug-013)).** Frontend edits did nothing because
the container served a production build with no compiler watching — the
unaddressed follow-up from [BUG-012](../bugs/fixed_bugs.md#bug-012). Two smaller
faults compounded it: the sync target was one directory too high, and the
`rebuild` path resolved to `docker/package.json`.

- `frontend/Dockerfile` gained a `dev` stage running `next dev` and a shared `deps` stage; `runner` stays last so production builds are unaffected. Compose selects it via `build.target: dev`.
- Per-service watch rules: **frontend** syncs source (no restart), `sync+restart` for `next.config.ts`, `rebuild` for `package.json` / `package-lock.json`; **backend** `sync+restart` on the jar after `mvn package`, avoiding a rebuild that would re-send the whole repo as build context; **db** syncs init scripts, documented as near-inert since the schema is Flyway-owned.
- Verified: `✓ Ready in 746ms`, HTTP 200, and a file copied into the container triggers `✓ Compiled in 108ms` — so inotify works for synced writes and no polling vars are needed.
- Noted while working: `build.context` is the repo root with **no root `.dockerignore`**, so every image build tars up `node_modules`, `target/` and `.git`. Worth adding, but it must not exclude `backend/target/*.jar`, which `backend/Dockerfile` COPYs. — **Done 2026-08-05**; the jar is re-included by negation.

**2026-08-05 (b) — CI plan steps 5–6 landed; Node aligned on 24.**

- **Frontend lint now gates merges.** Fixed all 5 eslint errors and removed `continue-on-error` from `_frontend.yml`. The plan had them all in `app/lib/api.tsx`; in fact only 2 were (`no-explicit-any` on `apiFetch<T = any>`, and a `@ts-ignore`). The other 3 were `no-explicit-any` in `OAuthButtons.tsx`.
- **Replaced `(window as any).google` with real types** — new `app/types/google-identity.d.ts` declaring only the GIS surface this app calls, plus a `Window.google?` augmentation. This immediately caught a latent bug the `any` had been hiding: `client_id` was being passed `string | undefined`, because `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is optional and the guard did not narrow into the nested `init()`. Fixed by re-binding after the guard. GIS silently ignores unrecognised keys, so this class of typo produced no runtime error at all.
- Verified: `tsc --noEmit` clean, **0 lint errors** (15 warnings), **23/23 Jest**.
- **`.github/dependabot.yml`** *(new)* — maven `/backend`, npm `/frontend`, github-actions `/`, docker `/backend` + `/frontend`; weekly, minor/patch grouped per ecosystem, **majors ungrouped on purpose** so a breaking change cannot be rubber-stamped inside a "minor and patch" PR.
- **`codeql.yml`** *(new, standalone)* — `javascript-typescript` + `java-kotlin`, `fail-fast: false`, `build-mode: none`. Deliberately **not** part of `ci-success`: CodeQL's extractors trail new language releases and this project is on Java 25, so a broken Java analysis must not block merges. `build-mode: none` also avoids needing CodeQL to drive Maven on JDK 25 at all. Confirmed the repo is **public**, so this is free.
- **Node 20 → 24** across the project, following the `frontend/Dockerfile` change: `_frontend.yml` `node-version` and a stale base-image comment in `_docker.yml` were the only two references. There is no `engines` field or `.nvmrc` to update — worth adding one if the version should be enforced in one place.
- **Full tier measured with Docker running:** `./mvnw verify` → **40 tests, 39 pass**. The only failure is BUG-001. An earlier local run had errored on Testcontainers instead — the cause was environmental, not the code: Testcontainers' npipe strategy targets `//./pipe/docker_engine` while the active context is Docker Desktop's `dockerDesktopLinuxEngine`. `DOCKER_HOST=npipe:////./pipe/dockerDesktopLinuxEngine` fixes it locally; CI is unaffected.

**2026-08-05 (a) — CI restructured into one orchestrator (branch `ci/github-actions`).**
The four standalone workflows below were replaced. **Still nothing has run on
GitHub.** Plan steps 1–4 of 7.

- **The structural problem they had:** `paths:` filters at the *workflow* level make required status checks impossible. A PR touching only `frontend/` never *starts* `backend-ci`, so a branch-protection rule requiring it waits forever on "Expected — Waiting for status". Since branch protection was already a goal, that layout could never get there.
- **`ci.yml`** *(new, the only trigger)* — `changes` (dorny/paths-filter, failing **open** on a branch's first push where `github.event.before` is all zeros) → `secret-scan` (gitleaks binary, not the action, which needs a paid licence on org-owned repos) → four component calls → **`ci-success`, named `CI`**. That gate runs `if: always()`, needs every job, and fails only on `failure`/`cancelled` — `skipped` passes. That is precisely what lets job-level path filtering coexist with branch protection. **Require `CI` and nothing else.**
- **Tiering.** Fast tier on a branch push (compile, unit tests, lint, `tsc`, Jest, migration-file lint, secret scan). Full tier on PR, push-to-`main`, `merge_group` and manual dispatch (adds the `*IT` suites, a real Flyway migrate, and the Docker stack).
- **`_backend.yml` / `_frontend.yml` / `_database.yml` / `_docker.yml`** *(new, `workflow_call` only)* — the job bodies were **carried over intact**, not rewritten: the migration lint rules, the double-boot checksum/drift check, the compose fail-fast secret guard and the API smoke tests are all unchanged. Added: `permissions: contents: read` and `timeout-minutes` everywhere (the GitHub default is **six hours** per job).
- **`_docker.yml` gained two things** — it now builds and boots the **production** frontend image (`--target runner`), which nothing built before because compose pins `target: dev`; and it Trivy-scans both images. Verified locally: the prod image builds and serves `/` (`✓ Ready in 167ms`).
- **Deleted:** `backend-ci.yml`, `frontend-ci.yml`, `database-ci.yml`, `docker-ci.yml`, `frontend-cd.yml`, `.ci/build-publish.sh`.
- **Unit/integration split** — added `maven-failsafe-plugin` to `backend/pom.xml` and renamed `SearchIntegrationTest` → `SearchIT`, `AuthenticationFlowIntegrationTest` → `AuthenticationFlowIT`, `ClubAdminRequestFlowIntegrationTest` → `ClubAdminRequestFlowIT`. Declaring the plugin is *all* that is needed: `spring-boot-starter-parent` already binds `integration-test` + `verify` in pluginManagement, so adding an execution of our own would have run every IT **twice**. Verified: `./mvnw test` → 14 unit tests, no Spring context, no Docker; `./mvnw verify` → those plus 20 in the three `*IT` classes, each run exactly once.
- **Root `.dockerignore`** *(new)* — both Dockerfiles use the repo root as build context and there was none (`frontend/.dockerignore` sits one level too deep to apply). Measured: frontend build context **688 KB**; backend **76.03 MB**, which is the jar alone — so the `backend/target/*` + `!backend/target/campusvibe-*.jar` negation works.
- **`frontend/Dockerfile`** — `npm install` → `npm ci`. CI enforced the lockfile and the image did not, so one commit could resolve two different dependency trees.
- **`backend/mvnw`** is now mode `100755` in the index, removing a `chmod +x` step from three jobs.

**2026-07-31 — GitHub Actions CI (branch `ci/github-actions`).** Four workflows,
all YAML-validated locally. **None ran on GitHub; superseded by the entry above.**

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
