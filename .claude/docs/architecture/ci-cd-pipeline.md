# CI/CD Pipeline — Implementation & Design Decisions

**Status:** 2026-08-16 · branch `develop` ·
**`main` is governed by the `Protect main` ruleset; the pipeline is a real merge
gate** · **these workflows deploy nothing — but Vercel does, outside them.**
**Authors:** main session (pre-dates the agent team).
**Code as of:** trigger rework of 2026-08-16

> **Note, 2026-08-16.** The dated banner below is kept as a record of where the
> pipeline stood on 2026-08-07 and **parts of it have since been overtaken**:
> `main` is no longer unmergeable (29 PRs have merged), BUG-016 and BUG-017 were
> confirmed green on GitHub, and the fast/full tiering it refers to no longer
> exists. The current model is [The trigger
> model](#the-trigger-model-and-why-there-are-no-tiers-any-more). This banner has
> not otherwise been re-audited line by line.

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
> **Correction, 2026-08-07: this document said *nothing is deployed*, and that
> was wrong.** Vercel has been building the frontend through its GitHub
> integration all along — outside `ci.yml`, outside `ci-success`, and outside
> branch protection. It surfaced only when a Vercel preview build failed
> ([BUG-017](../../bugs/fixed_bugs.md#bug-017)). **A frontend change can pass
> `CI` and still fail to deploy**, and until 2026-08-07 nothing in this
> repository said so. The gap that remains — no `vercel.json`, no record of the
> project's build settings or environment variables — is
> [BUG-018](../../bugs/bugs.md#bug-018). What is still true: **these workflows**
> deploy nothing, and there is no AWS account, registry or backend deployment.
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

Every pull request into `main` runs an automated check suite on GitHub's servers,
and as of 2026-08-07 that suite **must pass before anything can merge** — you
cannot push to `main` directly, and a broken build is stopped by a machine rather
than caught after the fact. As of 2026-08-16 each commit is tested **once**: a
push to a working branch gets a fast, scoped run from `branch-checks.yml`, a pull
request gets everything from `ci.yml`, and a branch that already has an open PR
skips the push run rather than doing both. Nothing runs after a merge to main,
because the ruleset's up-to-date requirement makes that provably redundant.
**These workflows deploy
nothing** — there is no AWS
account or registry yet — but that is not the same as nothing being deployed:
**Vercel builds and previews the frontend on its own**, triggered by GitHub
rather than by anything here, so it can fail on a commit this suite calls green.
It has already paid for itself several times over:
three dependency upgrades that break the frontend build, a missing health
endpoint that would have left any deployment platform unable to tell whether the
app had started, and a vulnerable slider library that was shipping to every
visitor's browser alongside an entire build toolchain nobody meant to deploy.

## Read this before you change anything here

- **`.github/workflows/ci.yml`** is the only file with real triggers. Everything
  named `_*.yml` is a reusable workflow that runs only when `ci.yml` calls it.
- **Do not add a `push:` trigger back to `ci.yml`.** Branch pushes are covered by
  `branch-checks.yml`, on purpose and under a different check name — a second run
  emitting `CI` could satisfy the merge gate having skipped the expensive jobs.
  See [The trigger model](#the-trigger-model-two-workflows-two-check-names).
  `codeql.yml` is the one deliberate exception to the no-`push` rule; its main
  run is the code-scanning baseline, not a duplicate.
- **Nothing outside `ci.yml` may define a job whose display name is `CI`.**
  `grep -rn "name: CI$" .github/workflows/` should return exactly one line.
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
ci.yml            on: pull_request → main | merge_group | workflow_dispatch
│                 THE MERGE GATE. Everything, unfiltered.
├─ changes            did anything that is not documentation change?
├─ secret-scan    →   _secret-scan.yml
├─ backend        →   _backend.yml   ┐
├─ frontend       →   _frontend.yml  │ all four, in parallel,
├─ database       →   _database.yml  │ unless the change is docs-only
├─ docker         →   _docker.yml    ┘
└─ ci-success  ← named `CI`. THE required check. Require this and nothing else.

branch-checks.yml on: push, branches-ignore main / dependabot / merge queue
│                 THE ITERATION LOOP. Fast, scoped, never gates anything.
├─ should-run         open PR for this branch? then skip — ci.yml has it
├─ secret-scan    →   _secret-scan.yml
├─ backend        →   _backend.yml   (run-integration-tests: false)
├─ frontend       →   _frontend.yml
└─ database       →   _database.yml  (run-migrate: false)

codeql.yml        standalone, on main + PR + weekly. NOT part of the gate.
```

### Why path filtering is coarse

Until 2026-08-16 each component had its own globs: `backend/**` ran the backend
job, `frontend/**` ran the frontend job. That asks the question the fragile way
round. Per-component globs are a **hand-written dependency graph**, and an
incomplete one does not fail — it skips a job and reports green. A CI system can
survive almost any defect except silently not running.

Inverted, the burden moves from *prove this component is affected* to *prove
nothing is affected*, and the only list to maintain is of paths that provably
cannot influence a build (`**/*.md`, `.claude/**`, `.vscode/**`, `LICENSE`,
`.gitattributes`). Anything not on that list runs everything, so forgetting to
update it costs minutes rather than coverage. The `decide` step tests
`!= 'false'` rather than `== 'true'`, so an empty or unexpected filter output
also runs everything.

Two things make this affordable, and if either stops being true it is worth
revisiting: the repository is **public**, so Actions minutes are free, and CI
runs **once per PR**. Under the old push-triggered pipeline this would have been
roughly twelve minutes per commit, and nobody reads a CI system that slow. The
jobs run in parallel, so a code PR costs the slowest job rather than their sum.

**What this does not fix**, and is worth knowing before assuming it did: running
the frontend job on a backend change would never have caught API drift, because
the frontend has no compile-time knowledge of the backend's types. That gap is
closed separately by the contract test — see
[`contracts/api-dto-fields.json`](#contractsapi-dto-fieldsjson--the-api-contract).

### The trigger model: two workflows, two check names

GitHub fires `push` *and* `pull_request` for the same commit, so when both live
in one workflow every commit on a branch with an open PR is tested twice, and
again after the merge. Measured over twenty CI runs on 2026-08-16: **12 commits
ran twice, one ran three times.** Dependabot was hit hardest, because it pushes a
branch and opens a PR — five ecosystems, weekly.

The first fix was to delete `push` from `ci.yml`. That stopped the duplication
and overshot: a branch with no PR then ran **nothing at all**, which is how a
push to `ci/github-actions` sailed through untested. Branch pushes are now
handled by `branch-checks.yml`.

**Why a second workflow and not a `push:` trigger on `ci.yml` — this is the part
worth understanding before changing any of it.** A required status check is
matched by **name**. `ci.yml` emits `CI`, the single context the ruleset
requires. If a push-triggered run also emitted `CI`, two runs would produce that
context on one commit, and the run that satisfies the gate could be the push run
— which deliberately skips the integration suites, the real Flyway migration and
the whole Docker stack. A green gate on an untested merge is the worst outcome
available here. Separate workflow, separate check name, no ambiguity: **nothing
outside `ci.yml` may ever be named `CI`.**

**How the double run stays dead.** `branch-checks.yml`'s first job asks whether
the branch already has an open PR (`gh pr list --head`) and skips everything if
so, because `ci.yml` is already testing that commit more thoroughly. The branch
name reaches that script through `env`, never `${{ }}` interpolation — a branch
name is chosen by whoever pushes — and the lookup fails **open**, so an API
hiccup runs the checks rather than skipping them.

**Tiering came back, renamed.** `_backend.yml` takes `run-integration-tests` and
`_database.yml` takes `run-migrate`, both defaulting to **true** so a caller that
forgets one gets more testing rather than less. These are the `full-tier` input
under a better name: `full-tier` described *which CI tier the caller was in*,
which is why it read as meaningless the moment the tiers were rearranged; the new
names describe what the flag actually does.

**`main` is governed by the `Protect main` ruleset** (repository ruleset id
`20558306`, active, targeting `~DEFAULT_BRANCH`). Note that rulesets do **not**
answer on the classic `/branches/main/protection` endpoint — that returns 404
here, which reads as *unprotected* if you do not know to look at
`/repos/{owner}/{repo}/rulesets`. It enforces:

| Rule | Effect |
|---|---|
| `pull_request` | No direct pushes to main; 0 approvals required (solo repo) |
| `required_status_checks` | Exactly one context: **`CI`** — the `ci-success` job |
| `strict_required_status_checks_policy: true` | The PR branch must be up to date with main before merging |
| `deletion` | main cannot be deleted |
| `non_fast_forward` | main cannot be force-pushed |

**The strict policy is why no CI runs on main, and this is the load-bearing
sentence in this section.** Because a PR branch must be current with main before
it can merge, what the PR tested *is* the merge result — a main run would
re-prove the same commit seconds later. If `strict_required_status_checks_policy`
is ever turned off, that reasoning dies and `push: branches: [main]` has to come
back. Do not restore it before then thinking it is a gap; it is not.

**What this costs.** While a PR is open, every push to that branch runs the
**full** suite through `pull_request: synchronize`, not the fast one. That is
inherent rather than chosen: the required `CI` check has to exist on the head
SHA, so each new commit must be re-gated. `branch-checks.yml` therefore helps
before the PR is opened, which is most of a branch's life if PRs are opened when
work is ready rather than left open for days. The concurrency group cancels
superseded PR runs, so a burst of pushes collapses to one full run.

The integration suites, the real migration and the Docker stack still first run
at the PR. `scripts/verify.mjs` via `.githooks/pre-push` remains the only check
that runs *before* the push — and it needs `git config core.hooksPath .githooks`
in each clone, which is a local setting and cannot be committed.

---

## File-by-file breakdown

### `.github/workflows/ci.yml` — the orchestrator

The only workflow with real triggers. Everything named `_*.yml` is reusable and
fires only when this file calls it.

Concurrency is keyed on the PR number, so a rapid series of pushes leaves one
run rather than a queue of superseded ones. `cancel-in-progress` is restricted to
`pull_request`: a merge-queue run is gating a specific merge, and cancelling it
fails that merge.

**Job `changes`** answers one question: did anything that is not documentation
change? It has a single output, `code`.

- Step `force` detects the two events where change detection cannot be trusted —
  `workflow_dispatch` and `merge_group`, neither of which gives paths-filter a
  base commit to diff against. Either sets `all=true` and everything runs. (It
  used to also handle a branch's first push, whose `github.event.before` is all
  zeros; that case left with the `push` trigger.)
- Step `filter` runs `dorny/paths-filter` with one inverted filter — `'**'` minus
  the inert paths — skipped entirely when `all=true`. On `pull_request` it diffs
  against the base branch, which always exists.
- Step `decide` writes the result with `tee -a "$GITHUB_OUTPUT"` so the decision
  is visible in the log rather than silently piped away, and prints which of the
  two outcomes it chose.

**Job `secret-scan`** checks out with `fetch-depth: 0`, installs a **pinned**
gitleaks binary and runs `gitleaks git . --redact --verbose --no-banner`. Runs on
every change regardless of which paths were touched — a leaked credential is the
one failure a follow-up commit cannot undo.

The version was previously resolved from the GitHub releases API at run time, on
the reasoning that a stale tag could never break the pipeline. That was reversed
on 2026-08-16: the step pipes a downloaded tarball into `sudo tar` inside a job
holding repository credentials, so whatever upstream published minutes earlier
would execute as root, unreviewed. Availability was the wrong thing to optimise
there. Dependabot does not watch raw downloads, so `GITLEAKS_VERSION` is bumped
by hand.

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
preceding step prints every component's result, so the log answers *why did
nothing run* without opening the job graph.

### `.github/workflows/branch-checks.yml` — the iteration loop

Triggers on `push` with `branches-ignore: [main, 'dependabot/**',
'gh-readonly-queue/**']`. Three exclusions, three different reasons: `main`
because the merge result was already tested, `dependabot/**` because Dependabot
opens a PR in the same breath so branch checks there are always superseded, and
the queue branches because `ci.yml` covers them via `merge_group`.

**Job `should-run`** is the whole point of the file. It asks
`gh pr list --head "$BRANCH" --state open` and, if the branch has a PR, sets
`skip=true` so every later job is skipped — `ci.yml` is already testing that
commit more thoroughly. Then it path-filters per component, restoring the
scoping that `ci.yml` deliberately does not use.

Per-component globs are fragile: an incomplete one skips a job and reports green.
That is unacceptable on a merge gate and fine here, because the PR runs
everything unfiltered regardless — the worst a wrong glob costs on a branch is
later feedback, never a missed failure. This is the same trade-off read two ways,
and the reason the two workflows filter differently.

Two safety details worth keeping: the branch name reaches the shell through
`env` rather than `${{ }}` interpolation (a branch name is attacker-chosen), and
the PR lookup ends in `|| echo 0` so an API failure runs the checks instead of
skipping them.

Calls `_backend.yml` with `run-integration-tests: false` and `_database.yml` with
`run-migrate: false`. Never calls `_docker.yml`. Nothing here may be named `CI`.

### `.github/workflows/_secret-scan.yml`

Extracted from `ci.yml` on 2026-08-16 when `branch-checks.yml` needed the same
scan. Copying it would have put the pinned gitleaks version in two files, and the
copy nobody edits is the one that rots — a stale scanner in the job whose entire
purpose is catching the one mistake a follow-up commit cannot undo.

Unscoped in both callers: a credential can be committed to any file, so filtering
it by component would be filtering the wrong thing.

### `.github/workflows/_backend.yml`

`workflow_call` with one optional input, `run-integration-tests` (default
**true**). JDK 25 temurin, `cache: maven`, 20-minute timeout. True runs
`./mvnw -B verify`; false adds `-DskipITs`, dropping only the failsafe classes.
The jar is packaged either way, so downstream jobs are unaffected.

Defaulting to true matters: `ci.yml` calls this with no arguments, so a caller
that forgets the input gets more testing rather than less.

The check is an `if` in bash, not a GitHub expression, and that is not style. An
empty string is falsy in GitHub expressions, so the tempting
`inputs.run-integration-tests && '' || '-DskipITs'` evaluates wrong in the *true*
branch and silently skips the suites it meant to run.

This input existed as `full-tier`, was deleted on 2026-08-16 when `ci.yml`
stopped triggering on push, and returned hours later with `branch-checks.yml`.
The name changed on the way back because `full-tier` described which CI tier the
caller was in — a policy — so it read as meaningless the moment the tiers moved.

Test reports upload `if: always()`; the jar uploads with
`if-no-files-found: error`.

### `.github/workflows/_frontend.yml`

Node **24**, matching `frontend/Dockerfile`. `npm ci` → lint → type-check →
`npm test -- --ci` → `npm run build`. Never had a tier — the whole job is under
two minutes, so there was never anything worth deferring.

Every step carries `if: '!cancelled()'`, so one push reports every problem at
once instead of one per re-run.

Lint has been **blocking since 2026-08-05**. The build step sets
`NEXT_PUBLIC_API_URL` and an empty `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only so the
build is deterministic in CI; the real Docker build passes them as build args
(BUG-004).

### `scripts/verify.mjs` + `.githooks/pre-push` — the same checks, before the push

Added 2026-08-14, after two consecutive pushes broke the Frontend job for two
different reasons: the checks were never run (BUG-026), and then the checks were
run and passed in an environment CI does not have (BUG-027).

The second is the one worth understanding. `/clubs` prerendered at build time
and needed a live backend; the dev machine had one on `:8080`, so the build
passed locally and failed on a runner that has none. **Running the same commands
is not enough — the environment has to match too.**

So the build step points `API_INTERNAL_URL` at a **closed port**, chosen by
bind-testing rather than hardcoded (a port that happened to be occupied would
let the build fetch something and pass). Any route that fetches during
`next build` then fails exactly as it does on a runner. `.next` is cleared first,
because BUG-021 was a stale Turbopack cache serving pre-edit output, and a check
that trusts that cache can repeat it.

```bash
git config core.hooksPath .githooks   # once per clone, activates the hook
cd frontend && npm run verify         # or run it directly any time
```

The hook scopes work the way `ci.yml` does — only changed components, and
**fail open** when there is no base to diff against. Bypass with
`git push --no-verify`.

It matters more than it used to. Since CI stopped triggering on `push`, this is
the only thing standing between an edit and the pull request. It still skips the
backend integration suites by default, which is the right trade for an iteration
loop; `node scripts/verify.mjs --all --full` runs them before opening a PR.

Backend runs through the same script, which resolves `JAVA_HOME` itself (no JDK
is on `PATH` on the dev machine) and reads the exit code from the process rather
than through a pipe — a piped `mvnw` reports the exit status of `tail`, which is
how a failed build once looked green.

**This does not replace CI.** It runs on one developer's machine, in one
timezone and locale, with whatever is cached; CI remains the arbiter. It exists
so the obvious failures are found in the terminal that caused them.

### `.github/workflows/_database.yml`

Exists separately from the backend job for a specific reason: the backend suite
runs on in-memory H2 with `ddl-auto: create-drop` and `flyway.enabled: false`, so
Hibernate builds the schema from the entities and **the migration files are
never executed**. A migration could be malformed, misnumbered or drifted from the
entities and the entire backend suite would still pass.

Two jobs, split so the cheap one fails first:

- **`lint-migrations`** — no database, seconds. Enforces
  `V<n>__<snake_case>.sql`, rejects duplicate version numbers, greps for
  real-looking email addresses and for password/secret/api-key/token literals,
  and warns on `INSERT INTO users`. It runs first so a bad filename fails in
  seconds rather than after a Maven build and a Postgres container.
- **`migrate`** — boots the packaged jar twice against a
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

The most expensive job, and the only place that exercises the Dockerfiles, the
compose wiring and container-to-container networking. Affordable now that CI
runs once per PR rather than on every push.

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
Triggers on push to **`main` only**, PR to `main`, and a weekly Monday 07:00 UTC
cron.

**The main run is not a duplicate of the PR run, and must not be removed** when
tidying triggers elsewhere. Code scanning decides which alerts are *new on this
PR* by diffing against the most recent analysis of the default branch. With no
main analysis there is nothing to diff against and PR triage degrades to
reporting every alert in a touched file as new. It was a bare `push:` until
2026-08-16, meaning both languages were analysed on every push to every branch on
top of the PR run — the single largest source of wasted minutes in the repo.

The scheduled run is the point: it re-scans unchanged code against newly
published queries, catching vulnerabilities disclosed after the code was last
touched. Findings land under Security → Code scanning.

This is the only workflow with an elevated permission — `security-events: write`,
required to upload SARIF.

### `.github/workflows/codeql-triage.yml`

Added 2026-08-16. Reads the alerts a CodeQL run produced and writes a triage
back — a PR comment when the branch has a PR, the job summary otherwise.

**Why it is a separate workflow.** `codeql.yml` uploads SARIF and exits; the
alerts do not exist until the code-scanning service has ingested it. Anything
that reads them has to run afterwards, and `workflow_run` is the only trigger
that fires at that point. Nothing inside `codeql.yml` could do this job.

**It never writes code, and `security-events` is `read`, not `write`.** A CodeQL
finding splits three ways — a real defect, code that is correct as written, and a
false positive needing dismissal — and only the first is safe to automate.
Dismissal in particular is a judgement about *intent*, so it stays a human action
on the Security tab. The triage exists to make the queue readable, not to empty
it.

**Two traps recorded here because both are silent:**

- `workflow_run` only fires for workflow files present on the **default branch**.
  On a feature branch this file does nothing at all, and the Actions tab shows no
  reason why. `workflow_dispatch` is there to exercise it before it reaches
  `main`.
- The job is restricted to `workflow_run.event == 'pull_request'`. `codeql.yml`
  also analyses `main` to keep the baseline fresh, but those alerts were already
  triaged on the PR that introduced them, so triaging again after the merge
  spends an agent run producing a report with no PR to post to. The
  `concurrency` group is still keyed on the analysed SHA rather than the ref, as
  a second guard against duplicate comments.

Checkout uses `workflow_run.head_sha`, not the branch tip: they diverge the
moment anyone pushes while an analysis is running, and the triage would then
describe code CodeQL never looked at.

### `contracts/api-dto-fields.json` — the API contract

One list of JSON field names per DTO, read by a test on **each** side:
`backend/.../contract/ApiContractTest.java` and
`frontend/app/__tests__/api-contract.test.ts`.

**The gap it closes.** `frontend/app/types/index.ts` is a hand-written mirror of
the backend records — no OpenAPI generation, no shared package, three types
carrying a *Mirrors the backend…* comment and nothing enforcing it. Renaming a
field in `EventDTO` broke the frontend with **nothing failing anywhere**: the
backend suite passed, the frontend suite passed, and the defect reached a
browser. Neither suite could catch it alone, because neither side knows the
other's types. Path filtering was never the cause and running more jobs was
never the cure.

**How it works.** Both tests compare against the same file, so agreeing with it
is what makes them agree with each other.

- Backend: Jackson **introspection**, not serialisation of an instance — it needs
  no populated object and reports a field even when its value would be null. A
  test that built instances would silently stop checking any field left unset.
- Frontend: two layers. `Record<keyof ApiEvent, true>` is a compile-time
  exhaustiveness check — remove a field from the interface and the object has an
  excess property, add one and it is missing a key, so `npm run type-check` fails
  by name before any test runs. The assertion against the contract file is the
  runtime layer, and the one that catches interface-versus-record drift.
- Each side also asserts it mirrors **every** type the contract names, so adding
  a DTO to the file without a mirror fails rather than passing silently.

**Changing the API** means editing this file in the same commit as the code. Both
tests fail until both sides match, and the failure names the field and the side
that has not caught up.

Verified by simulating a rename (`organizerName` → `organiserName`) in the
contract: the backend test failed and the frontend test failed, independently.

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

`ActuatorHealthEndpointTest` is the one deliberate exception to *surefire loads
no Spring context*. It costs 8.3 s, and it is worth that because it guards the
readiness contract the database and docker jobs both poll
([BUG-015](../../bugs/fixed_bugs.md#bug-015)) — a unit test that fails in
seconds beats a container job that times out after ten minutes saying only that
nothing became healthy. Its annotations match `AbstractIntegrationTest` exactly,
so the TestContext cache reuses one context and failsafe pays nothing extra.
Keep new `@SpringBootTest` classes out of surefire unless they earn their place
the same way.

*(Its original justification — that the fast tier was the only place that could
fail on the push rather than on the PR — expired with the fast tier on
2026-08-16. The test is still worth its 8.3 s for the reason above.)*

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| One orchestrator + reusable `_*.yml` | Component scoping and a single required check are both needed | Four independent workflows with workflow-level `paths:` | Branch protection becomes impossible again |
| `ci-success` gate treating `skipped` as pass | GitHub cannot require a check that never started | Requiring each component job | A frontend-only PR waits forever on `Expected — Waiting for status` |
| Branch pushes in a separate workflow, not a `push:` trigger on `ci.yml` | A required check is matched by name; two runs emitting `CI` make it ambiguous which one gated the merge | Add `push` back and branch on `github.event_name` | The gate could go green on a run that skipped the integration, migration and Docker jobs |
| Skip branch checks when the branch has an open PR | `push` + `pull_request` double-fire on the same commit | Let both run | Half of all CI minutes spent re-testing commits already tested |
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

**Why actions are pinned to SHAs.** A tag is mutable: `actions/checkout@v4`
resolves to whatever that tag points at today, so a compromised or retagged
release executes in a job holding repository credentials with no diff to review.
SHAs are immutable, and Dependabot watches the `github-actions` ecosystem, so
they stay current without manual work. The same reasoning drove pinning gitleaks
and trivy, which are downloaded and executed as root — trivy previously ran an
install script piped from the upstream `main` branch.

*(This replaced a note on why the fast/full tier check was written in shell
rather than a GitHub expression — an empty string is falsy in GitHub
expressions, so `inputs.full-tier && '' || '-DskipITs'` evaluated wrong. Kept
here because the trap is real and worth knowing; the code it applied to is
gone.)*

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

**There is a second build of the frontend that this pipeline does not run.**
Vercel builds every push through its GitHub integration. It is not in `ci.yml`,
so it is not in `ci-success`, so branch protection has no opinion about it — a
frontend change can be green in `CI` and still fail to deploy, which is exactly
what [BUG-017](../../bugs/fixed_bugs.md#bug-017) was. It also builds from a
*different* configuration: `next.config.ts` branches on `process.env.VERCEL` and
skips `output: standalone` there, because Vercel does its own file tracing and
`next build` crashes on the standalone step otherwise. That branch is deliberate,
but it means **CI cannot prove the Vercel build works** — and did not. No
`vercel.json` exists, so the root directory, build command, Node version and
every `NEXT_PUBLIC_*` value live only in the Vercel dashboard
([BUG-018](../../bugs/bugs.md#bug-018)).

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

- **2026-08-16 (c)** — **Branch pushes test again, without the double run
  returning.** Dropping `push` from `ci.yml` had overshot: a branch with no PR
  ran nothing, which a push to `ci/github-actions` demonstrated. Added
  `branch-checks.yml` — its own workflow deliberately, because a required check
  is matched by name and a second run emitting `CI` could satisfy the gate
  having skipped the expensive jobs. It skips itself when the branch already has
  an open PR, so no commit is tested twice. `run-integration-tests` and
  `run-migrate` bring back the old tiering under names that describe behaviour
  rather than policy, defaulting to true. Secret scanning moved to
  `_secret-scan.yml` so its pinned scanner version has one home instead of two.
  *(main session)*

- **2026-08-16 (b)** — **Coarsened path filtering, and added a real API
  contract.** Per-component globs are a hand-written dependency graph whose
  failure mode is a silent skip reporting green, so they were replaced by one
  inverted filter: everything runs unless the change is provably inert. Free
  because the repo is public and CI now runs once per PR. Separately — and this
  is the gap that actually mattered — `contracts/api-dto-fields.json` plus a test
  on each side now pins the six DTOs the frontend hand-mirrors. Nothing had ever
  checked them, and running more CI jobs would not have: the frontend has no
  compile-time knowledge of the backend's types. *(main session)*
- **2026-08-16 (a)** — **Halved the CI bill without losing a check.** `ci.yml` and
  `codeql.yml` both listened to `push` and `pull_request` with no branch filter,
  so GitHub fired both for the same commit: 12 of the last 20 CI commits ran
  twice, one three times, and CodeQL analysed every branch on every push.
  `ci.yml` is now `pull_request` to main only — safe because the `Protect main`
  ruleset sets `strict_required_status_checks_policy: true`, which is now
  written down here as the load-bearing reason. Tiering went with the `push`
  trigger, since every surviving event was full-tier. `codeql.yml` keeps a
  main run, and the section says why so nobody prunes the code-scanning
  baseline. Also pinned every action to a SHA and gitleaks/trivy to versions,
  reversing the earlier deliberate choice to resolve gitleaks at run time.
  *(main session)*

- **2026-08-16** — Added `codeql-triage.yml`, so CodeQL findings get read
  without anyone remembering to look. Triage only: it comments, never commits,
  and holds `security-events: read` rather than `write` so it cannot dismiss an
  alert. Also recorded that `codeql.yml` now triggers on push to **every**
  branch, which is what gives the triage something to hang off. *(main session)*
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
- **2026-08-07** — **`output: standalone` broke every Vercel build**
  ([BUG-017](../../bugs/fixed_bugs.md#bug-017)), a regression from the commit
  above. `next build` reads `.next/next-server.js.nft.json` only inside the
  standalone path, and Vercel does its own tracing, so the step died on ENOENT.
  Made `output` conditional on `process.env.VERCEL`. **This document's claim
  that nothing is deployed was wrong** and is corrected throughout: Vercel has
  been building this repository through its GitHub integration the whole time,
  outside `ci.yml` and outside `ci-success`, so a green `CI` never implied a
  working deploy. Added as a known gap and as
  [BUG-018](../../bugs/bugs.md#bug-018). *(main session)*
- **2026-08-14** — **Moved the first line of defence off the runner and onto the
  machine that writes the code.** Two consecutive pushes broke the Frontend job:
  [BUG-026](../../bugs/fixed_bugs.md#bug-026), a type error from checks that
  were never run, and then [BUG-027](../../bugs/fixed_bugs.md#bug-027), a build
  that prerendered `/clubs` and needed a backend. The second passed locally
  **because the dev machine had the backend running**, which is the lesson:
  running CI's commands is not the same as running them in CI's environment.
  Added `scripts/verify.mjs` (CI's four frontend steps plus the backend tier, in
  CI's order, continuing past failures as CI does, with the build pointed at a
  closed port) and `.githooks/pre-push` to enforce it, scoped and failing open
  exactly as `ci.yml` does. Proved it works by reverting the `/clubs` fix and
  confirming the script reproduces the CI failure — same digest — with the
  backend container still up. Also fixed
  [BUG-025](../../bugs/fixed_bugs.md#bug-025), without which the local suite
  reported a permanent false failure and the guardrail would have been ignored.
  *(main session)*
