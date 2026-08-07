# CI/CD Pipeline — Implementation & Design Decisions

**Status:** 2026-08-06 · branch `ci/github-actions` · `88a03b1` plus uncommitted
work · **CI only — nothing is deployed.**

> **Read this first.** None of these workflows has ever executed on GitHub. The
> branch has not been pushed. Everything below describes code that has been
> validated locally — YAML parsed, shell logic reasoned through, Maven and Docker
> steps run by hand — but not one run exists in the Actions tab. The first push
> is the real test. See [Known gaps](#known-gaps-and-blockers).

---

## Overview

Six workflow files under `.github/workflows/`, plus `.github/dependabot.yml`,
`.dockerignore` and `.gitleaksignore` at the repo root. There is **no CD**: no
deploy job, no registry, no cloud credentials.

The whole design turns on one constraint. The goal is branch protection on
`main` — a rule that blocks a merge until CI passes. GitHub implements that by
requiring a named status check. But work here is component-scoped: a
frontend-only PR has no reason to spend twelve minutes booting Postgres. Those
two requirements conflict in the obvious layout, and the conflict is what the
architecture exists to resolve.

The resolution: **one workflow, filtering at the job level, behind a gate job
that always reports.**

```
ci.yml     on: pull_request | push | merge_group | workflow_dispatch
│
├─ changes        which components did this touch? which tier?
├─ secret-scan    gitleaks over commit history          every tier
│
├─ backend    → _backend.yml     if backend paths changed
├─ frontend   → _frontend.yml    if frontend paths changed
├─ database   → _database.yml    if db paths changed
├─ docker     → _docker.yml      if docker paths changed AND full tier
│
└─ ci-success  ← named `CI`. THE required check. Require this and nothing else.

codeql.yml    standalone, on main + weekly. NOT part of the gate.
```

The second idea is **tiering**. A push to a feature branch is an iteration loop
and gets a roughly three-minute answer. A pull request is the merge gate and can
afford twelve minutes.

| | branch push (fast) | PR · push to `main` · merge queue · dispatch (full) |
|---|---|---|
| Secret scan | ✅ | ✅ |
| Migration file lint | ✅ | ✅ |
| Backend compile + unit tests | ✅ | ✅ |
| Frontend lint · tsc · Jest · build | ✅ | ✅ |
| Backend `*IT` integration suites | — | ✅ |
| Flyway migrate on real Postgres, twice | — | ✅ |
| Docker stack build + boot + API smoke | — | ✅ |
| Trivy image scan | — | ✅ |

`main` re-runs the full suite because a merge result can differ from the PR head
that was tested.

---

## File-by-file breakdown

### `.github/workflows/ci.yml` — the orchestrator

The only workflow with real triggers. Everything named `_*.yml` is reusable and
fires only when this file calls it.

Concurrency is `ci-${{ github.ref }}` with `cancel-in-progress` set to
`github.ref != 'refs/heads/main'`. Superseded runs on a feature branch are noise;
on `main` they are history, and every commit that lands should have a completed
run against it.

**Job `changes`** decides scope and tier.

- Step `force` detects the cases where change detection cannot be trusted:
  `workflow_dispatch`, `merge_group`, or a push whose `github.event.before` is
  all zeros (a branch's first push — there is no base commit to diff against).
  Any of those sets `all=true` and everything runs.
- Step `filter` runs `dorny/paths-filter@v3`, skipped entirely when `all=true`.
- Step `decide` ORs the force flag, the `workflows` filter and each component
  filter, writing the result with `tee -a "$GITHUB_OUTPUT"` so the decision is
  visible in the log rather than silently piped away.
- Output `full-tier` is a pure expression:
  `github.event_name != 'push' || github.ref == 'refs/heads/main'`.

**Job `secret-scan`** checks out with `fetch-depth: 0`, installs the gitleaks
binary (version resolved from the GitHub releases API at run time), and runs
`gitleaks git . --redact --verbose --no-banner`. Runs in every tier, on every
change, regardless of which paths were touched — a leaked credential is the one
failure a follow-up commit cannot undo.

**Job `ci-success`**, display name `CI`. The load-bearing piece:

```yaml
if: always()
needs: [changes, secret-scan, backend, frontend, database, docker]
steps:
  - name: Fail if any component failed or was cancelled
    if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
    run: exit 1
```

`always()` makes it report even when every component skipped. The failure test
counts only `failure` and `cancelled`, so `skipped` passes. That combination is
exactly what lets job-level path filtering coexist with branch protection. A
preceding step prints every component's result and the tier, so the log answers
*why did nothing run* without opening the job graph.

### `.github/workflows/_backend.yml`

`workflow_call` with one required input, `full-tier: boolean`. JDK 25 temurin,
`cache: maven`, 20-minute timeout.

The tier is applied in shell rather than in a GitHub expression:

```yaml
run: |
  if [ "${{ inputs.full-tier }}" = "true" ]; then
    ./mvnw -B verify
  else
    ./mvnw -B verify -DskipITs
  fi
```

Both branches run `verify`, so the jar is packaged either way. `-DskipITs` is
failsafe's own property — nothing extra is needed to make it work.

Test reports upload `if: always()`; the jar uploads with
`if-no-files-found: error`.

### `.github/workflows/_frontend.yml`

Node **24**, matching `frontend/Dockerfile`. `npm ci` → lint → type-check →
`npm test -- --ci` → `npm run build`. Runs identically in both tiers — the whole
job is under two minutes, so there is nothing worth deferring.

Every step carries `if: '!cancelled()'`, so one push reports every problem at
once instead of one per re-run.

Lint has been **blocking since 2026-08-05**. The build step sets
`NEXT_PUBLIC_API_URL` and an empty `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only so the
build is deterministic in CI; the real Docker build passes them as build args
(BUG-004).

### `.github/workflows/_database.yml`

Exists separately from the backend job for a specific reason: the backend suite
runs on in-memory H2 with `ddl-auto: create-drop` and `flyway.enabled: false`, so
Hibernate builds the schema from the entities and **the migration files are
never executed**. A migration could be malformed, misnumbered or drifted from the
entities and the entire backend suite would still pass.

Two jobs, tiered independently:

- **`lint-migrations`** — no database, seconds, **both tiers**. Enforces
  `V<n>__<snake_case>.sql`, rejects duplicate version numbers, greps for
  real-looking email addresses and for password/secret/api-key/token literals,
  and warns on `INSERT INTO users`. A bad filename should be caught on the push
  that introduced it, not on the PR.
- **`migrate`** — full tier only. Boots the packaged jar twice against a
  `pgvector/pgvector:pg15` service container.

The double boot is the important part. First boot on an empty schema applies
every migration; because `application.yml` sets `ddl-auto: validate`, a
successful start **also** proves the JPA entities still match the migrated
schema. Then `flyway_schema_history` is compared against the file count. The
second boot proves migrations are not re-applied and that every checksum still
matches — an already-applied migration that someone edited fails here rather
than in production. Nothing else in the repo catches either kind of drift.

### `.github/workflows/_docker.yml`

The most expensive job, full tier only. The only place that exercises the
Dockerfiles, the compose wiring and container-to-container networking.

In order:

1. **Assert compose refuses to start without secrets.** Runs before `.env` is
   written and expects `docker compose config` to *fail*, mentioning
   `POSTGRES_PASSWORD` or `JWT_SECRET`. This guards the `:?` fail-fast markers;
   a regression would let an environment start with no JWT secret.
2. Build the jar (`./mvnw -B -DskipTests -DskipITs package`) — `backend/Dockerfile`
   COPYs `backend/target/campusvibe-*.jar` rather than building in-image.
3. Generate `docker/.env` with a throwaway password and
   `JWT_SECRET=$(openssl rand -hex 32)`.
4. `docker compose build` then `up -d`. Health is awaited **per service** rather
   than with `--wait`, because `--wait` masks which service failed.
5. Smoke-test the API: `/ping`; `/api/v1/clubs` asserted **non-empty** rather
   than a fixed count, which proves the backend reached Postgres over the compose
   network rather than merely starting; club search; and a protected route that
   must return 401 or 403 unauthenticated.
6. **Build and boot the production frontend image.** Compose pins
   `target: dev`, so the `runner` stage — the image that would actually ship —
   is built nowhere else. Runs on port 3001 to avoid the dev container on 3000.
7. **Trivy**, two passes. Pass one reports every fixable HIGH and CRITICAL with
   `--exit-code 0`. Pass two is the gate, narrowed to fixable CRITICAL with
   `--exit-code 1`.

Container logs dump `if: failure()`; teardown is `if: always()`.

### `.github/workflows/codeql.yml`

Standalone. Not called by `ci.yml`, not in `ci-success`, so a CodeQL failure
never blocks a merge. Matrix over `javascript-typescript` and `java-kotlin` with
`fail-fast: false`, `build-mode: none`, `queries: security-and-quality`.
Triggers on push and PR to `main` plus a weekly Monday 07:00 UTC cron.

The scheduled run is the point: it re-scans unchanged code against newly
published queries, catching vulnerabilities disclosed after the code was last
touched. Findings land under Security → Code scanning.

This is the only workflow with an elevated permission — `security-events: write`,
required to upload SARIF.

### `.github/dependabot.yml`

Five ecosystems, all weekly on Monday: maven `/backend`, npm `/frontend`,
github-actions `/`, docker `/backend`, docker `/frontend`. Minor and patch are
grouped into one PR per ecosystem; **majors are deliberately ungrouped**.

Docker needs one entry per Dockerfile directory — Dependabot does not search
recursively. Note that the gitleaks and Trivy binaries are resolved at run time,
so they are not Dependabot's to manage.

### `.dockerignore` (repo root)

`docker/docker-compose.yml` sets `context: ..` for both services, so the root
file — not `frontend/.dockerignore`, which sits a level too deep — is the one
that applies. Excludes `.git`, `.github`, `.claude`, all Markdown, every `.env`
form except `.env.example`, `*.pem`, `node_modules`, `.next` and build output.

The Java section is subtle:

```
backend/target/*
!backend/target/campusvibe-*.jar
```

The children are excluded rather than the directory, because Docker will not
re-include a file from a directory it has already excluded.

Measured: frontend build context **688 KB**; backend **76.03 MB**, which is the
jar alone — so the negation works.

### `.gitleaksignore`

One fingerprint: `JWTUtilTest`'s signing key, a literal chosen only because HS256
requires at least 32 bytes, flagged on entropy alone. The file's header states
the rule — an entry is only ever for a value that is provably not a credential;
anything that authenticated against a real system must be **rotated**, not
ignored, because rewriting history does not help once the commit is pushed.

### `backend/pom.xml` — the unit/integration split

`maven-failsafe-plugin` declared with **no `<executions>` block**. Surefire runs
`*Test`; failsafe runs `*IT`. `spring-boot-starter-parent` already binds
`integration-test` and `verify` in its pluginManagement, so merely declaring the
plugin activates it — adding an execution would run every IT twice.

Three classes were renamed to make the split possible: `SearchIntegrationTest` →
`SearchIT`, `AuthenticationFlowIntegrationTest` → `AuthenticationFlowIT`,
`ClubAdminRequestFlowIntegrationTest` → `ClubAdminRequestFlowIT`.
`AbstractIntegrationTest` keeps its name — surefire's default includes match it,
but both plugins skip abstract classes.

Measured: `./mvnw test` → **14 tests**, no Spring context, no Docker.
`./mvnw verify` → **40 tests**, each run exactly once.

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| One orchestrator + reusable `_*.yml` | Component scoping and a single required check are both needed | Four independent workflows with workflow-level `paths:` | Branch protection becomes impossible again |
| `ci-success` gate treating `skipped` as pass | GitHub cannot require a check that never started | Requiring each component job | A frontend-only PR waits forever on `Expected — Waiting for status` |
| Fast tier on push, full on PR | A branch push is an iteration loop; a PR is the merge gate | Full suite everywhere | ~12 min per push; people stop reading CI |
| Fail **open** when detection is unreliable | `github.event.before` is all zeros on a branch's first push | Treating no-diff as no-change | A branch's first push silently tests nothing |
| Any `.github/workflows/**` edit runs everything | The pipeline cannot be trusted to scope its own change | Filtering workflow edits like any other path | A broken workflow edit merges untested |
| `permissions: contents: read` at every workflow top level | Default token scope is far wider than any job needs | Repo default | Every job carries write scope it never uses |
| `timeout-minutes` on every job | The GitHub default is **six hours** | Leaving it unset | One hung job burns a day of runner minutes |
| CI only; CD scoped out | No AWS account, registry, or OIDC role exists | Writing a deploy job against placeholders | A deploy workflow that cannot deploy — the exact stub deleted as BUG-008 |

### Task-specific

**Why gitleaks scans `git`, not `dir`.** `dir` walks the filesystem with no
gitignore awareness — locally it read 99 MB of `frontend/.next` and returned
seven findings, every one a Next.js manifest key. `git` walks commits: 68
commits, 1.56 MB, 428 ms at gitleaks 8.30.1. It is also strictly stronger,
because a secret committed and later deleted is still compromised and only a
history scan sees it. Scanning the tree would report the repo clean while the
credential sat one `git log -p` away.

**Why the gitleaks binary rather than `gitleaks/gitleaks-action@v2`.** That
action requires a paid `GITLEAKS_LICENSE` for organisation-owned repositories and
fails closed without one. The binary has no such constraint. Its version is
resolved at run time rather than pinned, so a stale tag cannot break the
pipeline.

**Why `_docker.yml` builds its own jar.** Consuming `_backend.yml`'s artifact
would mean `needs: backend`, which serialises two jobs that should run in
parallel *and* breaks outright on a frontend-only PR — the docker job would still
need a jar while the backend job was skipped. The trade is deliberate: extra
runner minutes to keep the jobs parallel, accepting that docker smoke-tests a
bit-different jar than the one the backend job tested. Build-once-and-promote is
the real fix and belongs with CD, where a registry exists.

**Why the Trivy gate is CRITICAL-only.** Base images such as `node:24-alpine` and
`eclipse-temurin:25-jdk-alpine` routinely carry a handful of HIGHs that no change
in this repo can resolve. A gate that red-lights every PR for those trains people
to ignore CI — the same reasoning that kept frontend lint non-blocking until its
errors were actually fixed. Fixable CRITICALs are a small, actionable set,
usually resolved by bumping a base image tag. The plan called for HIGH+CRITICAL;
this is a deliberate departure, with tightening tracked in `todo.md`.

**Why CodeQL is outside the gate.** CodeQL's extractors trail new language
releases and this project is on Java 25. Kept standalone with `fail-fast: false`,
a broken Java extractor still leaves the JavaScript results reporting and `main`
mergeable. `build-mode: none` analyses source directly instead of observing a
compile — fewer results, but it avoids needing CodeQL to drive Maven on JDK 25 at
all, which is exactly the fragility the design tolerates rather than depends on.
Security findings are advisory input to a human; the things that *must* stop a
merge — secrets, tests, migrations — live in `ci.yml`.

**Why the tier check is shell, not a GitHub expression.** An empty string is
falsy in GitHub expressions, so the tempting
`inputs.full-tier && '' || '-DskipITs'` evaluates wrong in the true branch. An
explicit `if` in bash has no such trap.

**Why the database job boots the real jar instead of the Flyway CLI.** Booting
exercises the exact code path production uses, and `ddl-auto: validate` makes a
successful start double as an entity/schema drift check. The CLI would apply the
SQL and prove nothing about the entities.

**Why majors are ungrouped in Dependabot.** Majors are the ones that need
reading. Burying a major inside a *minor and patch* PR is how a breaking change
gets rubber-stamped.

**Why `--redact` on gitleaks.** The log is world-readable on a public repo.
Printing a match to prove it was found would publish it.

---

## Known gaps and blockers

**Nothing has run on GitHub.** The branch is unpushed. Local validation covered
YAML parsing, the Maven test split, both Docker build contexts, the production
frontend image serving `/`, and a clean gitleaks scan — but never the Actions
runtime.

**BUG-001 blocks branch protection.** Measured 2026-08-05 with Docker running:
`./mvnw verify` is **40 tests, 39 pass**. The single failure is
`SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords:163`. That test runs
in the **full tier**, so branch pushes stay green — but the moment `CI` becomes a
required check, `main` is unmergeable. Fix BUG-001, or quarantine **that one
method** with `@Disabled`. Disabling the whole class would also lose six passing
search tests.

**Branch protection is not enabled** and cannot be set from the working tree — it
needs repository settings. Require the single check named `CI`, plus require a
pull request and require branches up to date. **Do not require the component
jobs.** The check only becomes selectable in the UI after `ci.yml` has run once,
so push first.

**The V6 seed is load-bearing for two assertions.** `V6__insert_mock_clubs.sql`
seeds the 8 clubs that both `_docker.yml`'s `/api/v1/clubs` non-empty assertion
and `SearchIT.clubSearchFindsSeededClubs()` depend on.
[`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md) plans to
move that seed into a dev seeder — that migration breaks both assertions, so they
must move together.

**Docker Hub rate limits.** `pgvector/pgvector:pg15` is pulled by the database
service container, the compose stack and Testcontainers. Anonymous pulls from
GitHub-hosted runners share an IP pool. If pulls start failing, mirror to GHCR.

**Node 24 is pinned in two places** — `frontend/Dockerfile` and
`_frontend.yml` — with no `engines` field or `.nvmrc` to enforce agreement.

**BUG-004 is unaddressed.** `NEXT_PUBLIC_*` values are inlined at build time and
the production image passes no build args, so a deployed frontend would ship them
empty. Only matters once something deploys.

---

## Possible improvements

Ordered by value, each with the reason it has not been done. Tracked in
[`todo.md`](../TODO/todo.md) under Infrastructure & CI/CD.

1. **Push the branch and confirm a green run.** Blocks everything else here. The
   fast tier is expected green; the full tier will fail on BUG-001, which is the
   correct signal, not a pipeline defect.
2. **Enable branch protection** — needs step 1 first (the check is not selectable
   until it has reported) and a BUG-001 decision.
3. **Tighten the Trivy gate to HIGH** — after one clean run establishes the base
   image baseline. Doing it before means guessing at the noise floor.
4. **`output: standalone` in `next.config.ts`** and a `runner` stage that copies
   `.next/standalone` + `.next/static` and runs `node server.js`. The production
   image currently ships the full dev+prod `node_modules`. Now verifiable,
   because `_docker.yml` builds and boots that image.
5. **Add `.nvmrc` or an `engines` field** so the Node version has one source of
   truth instead of two.
6. **Extend `_database.yml` when the dev seeder lands** — assert `DevDataSeeder`
   does not run under the `prod` profile, and that
   `count(embedding) = count(*)`.
7. **Build-once / promote-one-artifact** — removes the duplicate Maven build in
   `_docker.yml`. Needs a registry, so it belongs with CD.
8. **CD itself.** Four prerequisites, none of which exist: an AWS account and EB
   environment (`docker/Dockerrun.aws.json` still carries the literal
   `<your-backend-image>:latest` placeholder), a GitHub OIDC role and trust
   policy, a registry decision between GHCR and ECR, and a Vercel project if the
   frontend goes there. **AWS auth must use OIDC** via
   `aws-actions/configure-aws-credentials` with `role-to-assume` — no long-lived
   `AWS_ACCESS_KEY_ID` repo secrets, and no LLM key in CI, ever.
9. **Merge queue.** `merge_group` is already in the trigger list so it works if
   enabled, but a single-maintainer repo does not need it.

---

## Change log

- **2026-08-06** — Created. Documents the pipeline as of `88a03b1` plus the
  uncommitted step 5–6 work (blocking lint, Dependabot, CodeQL, Node 24).
