# CI/CD Pipeline — Implementation & Design Decisions

**Status:** 2026-08-07 · branch `ci/github-actions` ·
**branch protection is ENABLED on `main`; the pipeline is now a real merge
gate** · **CI only — nothing is deployed.**
**Authors:** main session (pre-dates the agent team).

> **Read this first.** The pipeline is **enforced**. As of 2026-08-07 `main`
> requires a pull request, requires branches to be up to date, and requires the
> single status check named **`CI`**. Direct pushes to `main` no longer land.
> This document stopped describing a proposal and started describing a gate.
>
> **The immediate consequence: `main` is currently unmergeable.**
> [BUG-001](../../bugs/bugs.md#bug-001) fails in the full tier, the full tier
> runs on every pull request, and `CI` is required. Until BUG-001 is fixed or
> that one test method is quarantined, no PR can merge — including the nine open
> Dependabot PRs. That decision is now blocking rather than upcoming; see
> [Known gaps](#known-gaps-and-blockers).
>
> **The full tier has now run twice and failed twice, one step further each
> time.** Run one timed out on `/actuator/health`, which did not exist because
> `spring-boot-starter-actuator` was never a dependency
> ([BUG-015](../../bugs/fixed_bugs.md#bug-015)). Run two cleared that, ran the
> whole Docker stack, and failed on the Trivy gate with three fixable CRITICALs
> ([BUG-016](../../bugs/fixed_bugs.md#bug-016)) — one of which turned out to be
> an actual vulnerable runtime dependency shipping to browsers, and one of which
> was a build-time package that was only in the image because the production
> stage copied the entire `node_modules`. **Exactly the class of defect these
> jobs exist to catch** — no unit test could have found either, because nothing
> else in the repo builds the shipping artifact and looks inside it. Both are
> fixed and verified locally, but **neither is yet re-run on GitHub**; the first
> PR under branch protection is what confirms them.

## In one paragraph

Every push and pull request runs an automated check suite on GitHub's servers,
and as of 2026-08-07 that suite **must pass before anything can merge into
`main`** — you can no longer push to `main` directly, and a broken build is now
stopped by a machine rather than caught after the fact. It is deliberately
two-speed: a push to a working branch gets a roughly three-minute answer, while
a pull request runs the full twelve-minute suite including a real database and
the full Docker stack. **Nothing deploys** — there is no AWS account or registry
yet, so this is testing only. It has already paid for itself several times over:
three dependency upgrades that break the frontend build, a missing health
endpoint that would have left any deployment platform unable to tell whether the
app had started, and a vulnerable slider library that was shipping to every
visitor's browser alongside an entire build toolchain nobody meant to deploy.
The one thing to know before acting on it: **`main` cannot currently be merged
into at all**, because the known search bug (BUG-001) fails the full tier that
every pull request now has to pass. Fixing or quarantining that one test is the
next thing that has to happen.

## Read this before you change anything here

- **`.github/workflows/ci.yml`** is the only file with real triggers. Everything
  named `_*.yml` is a reusable workflow that runs only when `ci.yml` calls it.
- **`ci-success` is load-bearing, and now literally so.** It is the required
  status check on `main`, it runs `if: always()`, and it treats `skipped` as a
  pass. That is what lets job-level path filtering coexist with branch
  protection. **Its display name `CI` is wired into a repository setting that is
  not in this repo** — renaming the job, or changing its `if:` condition, breaks
  merging repo-wide and the fix is in GitHub settings, not in a commit.
- **The invariant that is easy to break:** the backend test suite runs on H2 with
  `flyway.enabled: false`, so it never executes the migration files. Only
  `_database.yml` does. Deleting that job means schema drift ships silently.
- Bound by [`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md)
  for anything touching migrations, and by the root `.dockerignore`, which both
  Dockerfiles depend on because compose sets `context: ..`.
- Open defects and priorities: [`bugs.md`](../../bugs/bugs.md) ·
  [`todo.md`](../../TODO/todo.md).

---

## Overview

Six workflow files under `.github/workflows/`, plus `.github/dependabot.yml`,
`.dockerignore` and `.gitleaksignore` at the repo root. There is **no CD**: no
deploy job, no registry, no cloud credentials.

The whole design turns on one constraint. The goal was branch protection on
`main` — a rule that blocks a merge until CI passes — and since 2026-08-07 it is
in force. GitHub implements that by requiring a named status check. But work
here is component-scoped: a frontend-only PR has no reason to spend twelve
minutes booting Postgres. Those two requirements conflict in the obvious layout,
and the conflict is what the architecture exists to resolve. That resolution is
no longer theoretical — it is what every merge now depends on.

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

Both boots wait on `/actuator/health` reporting `UP`, which requires
`spring-boot-starter-actuator` on the backend classpath — see
[BUG-015](../../bugs/fixed_bugs.md#bug-015) for what happens when it is missing.
On timeout the step prints the last HTTP status, because a connection refusal
(`000`) and a served-but-absent endpoint (`404` or `500`) mean entirely
different things and previously produced the same message.

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
   than with `--wait`, because `--wait` masks which service failed. The backend
   wait polls `/actuator/health` on the **published port** (see
   [BUG-015](../../bugs/fixed_bugs.md#bug-015)), reports the last HTTP status on
   timeout, and bails out early with container logs if `campusvibe-backend` has
   stopped running — a crash-loop and a missing endpoint used to be
   indistinguishable, and both cost the full 200-second wait.

   The compose file now gives the backend its own `healthcheck`, so this step
   could inspect container health instead. It deliberately does not: the compose
   probe runs *inside* the container, so an HTTP poll from the runner is the
   only thing that also proves the `8080:8080` mapping works. Container health
   is printed alongside the HTTP status on timeout, which separates a broken
   application from a broken port publish.

   One side effect: because `frontend.depends_on.backend` is now
   `condition: service_healthy`, `up -d` itself blocks until the backend is
   healthy and fails outright if it never is. That moves the failure earlier and
   makes it clearer, and the `if: failure()` log dump still runs.
5. Smoke-test the API: `/ping`; `/api/v1/clubs` asserted **non-empty** rather
   than a fixed count, which proves the backend reached Postgres over the compose
   network rather than merely starting; club search; and a protected route that
   must return 401 or 403 unauthenticated.
6. **Build and boot the production frontend image.** Compose pins
   `target: dev`, so the `runner` stage — the image that would actually ship —
   is built nowhere else. Runs on port 3001 to avoid the dev container on 3000.
   Since [BUG-016](../../bugs/fixed_bugs.md#bug-016) that stage is built from
   `.next/standalone` and started with `node server.js`; it no longer copies
   `node_modules`, and npm is deleted from it.
7. **Trivy**, two passes. Pass one reports every fixable HIGH and CRITICAL with
   `--exit-code 0`. Pass two is the gate, narrowed to fixable CRITICAL with
   `--exit-code 1`. On failure the step now reports the Trivy finding **class**
   and how to route it. It previously said `Bump the base image`, which was the
   one cause that applied to none of the three findings in the first real
   failure — see BUG-016.

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

Measured 2026-08-07: `./mvnw test` → **16 tests in 15.5 s**, no Docker.
`./mvnw verify` → **42 tests** expected, each run exactly once — 40 measured on
2026-08-05 plus the two new actuator cases; not re-measured since.

`ActuatorHealthEndpointTest` is the one deliberate exception to *the fast tier
loads no Spring context*. It costs 8.3 s of the 15.5 s, and it is worth that
because it guards the readiness contract both full-tier jobs poll — the fast
tier is the only place that can fail on the push that breaks it rather than on
the PR ([BUG-015](../../bugs/fixed_bugs.md#bug-015)). Its annotations match
`AbstractIntegrationTest` exactly, so the TestContext cache reuses one context
and the full tier pays nothing extra. Keep new `@SpringBootTest` classes out of
surefire unless they earn their place the same way.

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
errors were actually fixed. Fixable CRITICALs are a small, actionable set. The
plan called for HIGH+CRITICAL; this is a deliberate departure, with tightening
tracked in `todo.md`.

The original wording here added *usually resolved by bumping a base image tag*.
[BUG-016](../../bugs/fixed_bugs.md#bug-016) disproved it on the very first real
failure: of three CRITICALs, one was a declared runtime dependency, one was a
devDependency that had no business being in the image, and one was npm's own
bundled `tar` inside `node:24-alpine` **that no published tag fixed** — the
newer `node:25-alpine` carried an older, worse copy. Bumping the tag would have
fixed none of them. The gate now reports the finding class instead of asserting a
cause.

**A limit of image scanning worth stating plainly.** Now that the frontend image
ships `.next/standalone`, client-side dependencies have no `package.json` in it —
they are compiled into the browser chunks. Trivy cannot see them, so a green scan
says nothing about them. `swiper`'s prototype-pollution CVE was visible only
because the old image copied the whole `node_modules`; after the standalone
switch the same vulnerable code would ship silently. **Dependabot and
`npm audit` are the controls for client-side dependencies, not the image scan.**

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

**The full tier has run twice and failed twice — but it is advancing.** Run one,
on the merge to `main`, timed out in both full-tier jobs waiting on
`/actuator/health`, which did not exist
([BUG-015](../../bugs/fixed_bugs.md#bug-015)). Run two got past the health probe,
through the compose stack, through the API smoke tests, built and booted the
production frontend image — and then failed on the Trivy gate with three fixable
CRITICALs ([BUG-016](../../bugs/fixed_bugs.md#bug-016)). Each failure has been
one step further down the job than the last, which is what a pipeline being
brought up for the first time looks like.

Both are fixed and verified locally: the backend reproduced against
`pgvector/pgvector:pg15` — first boot UP in ~6 s with 8 of 8 migrations applied,
history clean, second boot UP with no re-apply, containerised backend UP in ~15 s
serving 8 clubs — and the frontend image rebuilt, booted (HTTP 200) and rescanned
to **zero fixable HIGH or CRITICAL findings**. **Neither fix is yet confirmed on
GitHub.** What has still never executed on a runner is now a much shorter list:
the Trivy gate *passing*, and the steps after it.

**Every readiness probe depends on one dependency.** Both full-tier jobs, the
compose backend healthcheck, and any future deployment health check all poll
`/actuator/health`. Removing `spring-boot-starter-actuator` from
`backend/pom.xml` breaks all of them at once, and none of it is a compile error.
This is now guarded by `ActuatorHealthEndpointTest` in the fast tier — verified
to fail with the exact CI symptom when the dependency is removed — so the
coupling is no longer silent. It is still a single point of failure worth
knowing about.

**Nine open dependency PRs are red** as of 2026-08-07. Three fail the *fast*
tier and are genuine breaking majors: `#22` eslint-config-next 16, `#21` eslint
10, `#20` lucide-react 1.28. Two fail both tiers: `#17` Spring Boot 4.1.0, `#15`
maven-minor-patch. Four fail only the full tier and are probably BUG-001. This is
the ungrouped-majors design working — but nothing tracked them for a day, which
is a process gap rather than a pipeline one.

**BUG-001 now blocks every merge.** This was a *predicted* blocker until
2026-08-07; branch protection made it a live one. Measured 2026-08-05 with
Docker running: `./mvnw verify` was **40 tests, 39 pass**. Adding
`ActuatorHealthEndpointTest`'s two cases should make that 42 and 41 — inferred,
not re-measured, because `verify` has not been run since. The single failure is
`SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords:163`. It runs in the
**full tier**, every pull request runs the full tier, and `CI` is required — so
**nothing can merge into `main` right now**, including the nine open Dependabot
PRs. Two ways out: fix [BUG-001](../../bugs/bugs.md#bug-001), or quarantine
**that one method** with `@Disabled("BUG-001: …")`. Disabling the whole class
would also lose six passing search tests. Nothing else in the full tier is
known-red, so this single method is the whole gate.

**Branch protection settings live outside the repository.** Enabled 2026-08-07
on `main`: require a pull request, require branches to be up to date, require
the single check named **`CI`**. Two consequences that are easy to miss because
no file in this repo records them:

- **The required check is matched by display name.** `ci-success` renders as
  `CI` via its `name:`. Renaming that job silently leaves branch protection
  waiting on a check that no longer exists, and every PR hangs on
  `Expected — Waiting for status`. **Do not require the component jobs** — that
  reintroduces the deadlock the whole architecture exists to avoid.
- **Require-branches-up-to-date serialises merges.** Each merge makes every
  other open PR out of date, forcing an update and a fresh full-tier run. With
  nine Dependabot PRs open that is nine sequential update-and-rerun cycles at
  roughly twelve minutes each. Fine for a single maintainer; the standard fix
  when it stops being fine is a merge queue, which `merge_group` is already
  wired for.

**The V6 seed is load-bearing for two assertions.** `V6__insert_mock_clubs.sql`
seeds the 8 clubs that both `_docker.yml`'s `/api/v1/clubs` non-empty assertion
and `SearchIT.clubSearchFindsSeededClubs()` depend on.
[`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md) plans to
move that seed into a dev seeder — that migration breaks both assertions, so they
must move together.

**Docker Hub rate limits.** `pgvector/pgvector:pg15` is pulled by the database
service container, the compose stack and Testcontainers. Anonymous pulls from
GitHub-hosted runners share an IP pool. If pulls start failing, mirror to GHCR.

**Node 24 is pinned in two places** — `frontend/Dockerfile` and
`_frontend.yml` — with no `engines` field or `.nvmrc` to enforce agreement.

**BUG-004 is unaddressed, and now runs on every full tier.** `NEXT_PUBLIC_*`
values are inlined at build time and the `builder` stage passes no build args, so
the production image ships them empty. BUG-016 rebuilt the `runner` stage but did
not touch the `builder` stage, which is where the defect lives. `_docker.yml` now
builds *and boots* that image on every full-tier run, so CI is exercising an
artifact that is already wrong in a way no assertion checks — the smoke test only
asks for HTTP 200 on `/`, which an empty API URL still returns.

---

## Possible improvements

Ordered by value, each with the reason it has not been done. Tracked in
[`todo.md`](../../TODO/todo.md) under Infrastructure & CI/CD.

1. **Resolve BUG-001.** No longer merely a bug — it is the reason `main` cannot
   be merged into at all. Everything below is blocked behind it, because every
   change now arrives through a PR that must pass the full tier.
2. **Get one full-tier run green.** Everything past the health probe in
   `_database.yml` and `_docker.yml` — the compose secret fail-fast, the
   production frontend image, the Trivy gate — has still never executed on a
   runner, because the only full-tier run so far died before reaching it. The
   BUG-015 fix is verified locally and nowhere else.
3. **Fix BUG-004** — build args for `NEXT_PUBLIC_*`. Promoted because CI now
   builds and boots the production image on every full-tier run, so the pipeline
   is actively producing a misconfigured artifact. Cheap: two `ARG`/`ENV` lines
   before `npm run build` and matching `build.args` in compose.
4. **Tighten the Trivy gate to HIGH** — the frontend image now measures **zero**
   fixable HIGHs locally, so the noise floor is no longer a guess for that half.
   The backend image has not been measured. Do it after one clean full-tier run
   establishes both baselines together.
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
9. **Merge queue.** `merge_group` is already in the trigger list, so enabling it
   is a settings change with no code behind it. Not needed for one maintainer
   today — but require-branches-up-to-date means each merge invalidates every
   other open PR, so the moment several PRs are in flight at once (the nine
   Dependabot ones, once BUG-001 unblocks them) this stops being optional.

---

## Change log

- **2026-08-06** — Created. Documents the pipeline as of `88a03b1` plus the
  uncommitted step 5–6 work (blocking lint, Dependabot, CodeQL, Node 24).
  *(main session)*
- **2026-08-06** — Moved from `.claude/docs/` to `.claude/docs/architecture/`;
  added the *In one paragraph* and *Read this before you change anything here*
  sections required by the revised `implementation-docs` skill. No change to any
  described behaviour. *(main session)*
- **2026-08-07** — **The pipeline ran.** Status, opening banner, summary, known
  gaps and improvements all corrected: the fast tier is verified green on
  `00a0933`; the full tier remains unrun on this branch; nine dependency PRs are
  red. The prior claim that nothing had ever executed was stale for about a day
  and was being read as fact by every agent — found by `sparring` on its first
  invocation. *(main session)*
- **2026-08-07** — **The full tier ran for the first time, on the merge to
  `main`, and failed.** Both full-tier jobs timed out on `/actuator/health`;
  `spring-boot-starter-actuator` had never been a dependency
  ([BUG-015](../../bugs/fixed_bugs.md#bug-015)). Status block, opening banner,
  summary, the `_database.yml` and `_docker.yml` sections and known gaps all
  updated. Both wait loops now report the last HTTP status on timeout, and the
  docker loop fails fast when the container stops. *(main session)*
- **2026-08-07** — Followed up on BUG-015 rather than only patching it.
  `ActuatorHealthEndpointTest` guards the readiness contract from the **fast**
  tier (verified to fail with the same `500` when the dependency is removed) and
  also asserts the actuator exposure ceiling holds. The compose backend gained a
  `healthcheck` and the frontend now waits on `service_healthy`. Fast tier is
  16 tests / 15.5 s, full tier 42. *(main session)*
- **2026-08-07** — **Branch protection enabled on `main`**: require a pull
  request, require branches up to date, require the single check `CI`. The
  document now describes an enforced gate rather than an intended one. Status
  block, banner, summary, overview and the `ci-success` entry updated; the
  *branch protection is not enabled* gap replaced with the settings that are now
  live and the two consequences they carry (the check is matched by display
  name; up-to-date serialises merges). **BUG-001 reclassified from a predicted
  blocker to an active one** — it fails the full tier, every PR runs the full
  tier, so nothing merges until it is fixed or quarantined. Improvements
  reordered behind it. *(main session)*
- **2026-08-07** — **Second full-tier run: past the health probe, failed on the
  Trivy gate** with three fixable CRITICALs
  ([BUG-016](../../bugs/fixed_bugs.md#bug-016)). Fixed by bumping `swiper` and
  `tar`, switching the frontend to `output: standalone` so the production image
  stops carrying the devDependency tree, and deleting npm from the `runner`
  stage — the third finding was npm's own bundled `tar`, which no published Node
  tag fixes. The gate's failure message no longer claims the base image is at
  fault; it reports the finding class and how to route it. Two documented
  claims were **wrong and are corrected**: that fixable CRITICALs are *usually*
  a base-image bump, and — newly added — that a green image scan says anything
  about client-side dependencies, which it no longer can. The `output:
  standalone` improvement item is now done and has been replaced by BUG-004,
  promoted because CI builds and boots that image on every full-tier run.
  Also picked up outside the gate: 12 HIGH findings against `next` 16.2.0,
  including an authentication bypass, cleared by an in-range update to 16.3.0.
  *(main session)*
