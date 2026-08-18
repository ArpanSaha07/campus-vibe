# AWS Deployment — Production Packaging and Rollout

**Date:** 2026-08-18 · **Branch:** `infra/aws-pipeline`
**Code as of:** d4afe79 *(plus the uncommitted `deploy/eb/` and
`scripts/package-eb.mjs` this document describes)*
**Authors:** Claude (Opus 5), with Arpan driving the AWS console
**State:** ⚠ **Partially live.** Phase 1 is complete and verified locally.
Phases 2–6 — RDS, S3, Elastic Beanstalk, the Vercel/Cloudflare front, CI/CD —
have **not been started**. Nothing of CampusVibe runs on AWS yet.

Plan of record: [`CampusVibe_AWS_Deployment_Guide.md`](CampusVibe_AWS_Deployment_Guide.md).
This document records what was actually built and where it departs from that plan.

---

## In one paragraph

The backend can now be packaged into the exact zip that Elastic Beanstalk
expects, and that package has been proven to boot in production mode against a
real PostgreSQL — health endpoint green, migrations applied, demo data correctly
absent. One command, `node scripts/package-eb.mjs`, produces the upload. Nothing
has been created on AWS yet, so there is no running environment, no database and
no bill; the next step is creating the RDS instance in `ca-central-1`. The one
thing worth knowing before deciding anything here: the production image is built
from a jar compiled on your machine, not on the AWS instance, and that is
deliberate — the target instance is too small to run Maven safely.

## Read this before you change anything here

- **Two Dockerfiles exist and must stay different.** `backend/Dockerfile` is
  built by Compose with the build context at the repo root
  (`docker/docker-compose.yml`), so it copies `backend/target/…`.
  `deploy/eb/Dockerfile:37` is built by Elastic Beanstalk with the context at
  the *bundle root*, where the jar sits beside it as `app.jar`. Unifying them
  would mean shipping the whole repository to the instance on every deploy.
- **`scripts/package-eb.mjs` is the only supported way to build the bundle.** An
  EB source bundle is a zip whose root *is* the build context — no wrapping
  folder. Zipping `deploy/eb/` by hand produces a bundle EB cannot build, and it
  fails minutes later in the console rather than locally.
- **Every configuration value is already externalised.** `application.yml` reads
  environment variables throughout; `application-prod.yml` carries non-secret
  overrides only. Adding a secret to either file is the failure mode this shape
  exists to prevent — see [`docker/EB-DEPLOYMENT.md`](../../../docker/EB-DEPLOYMENT.md)
  for the full property list.
- **Flyway V8 runs `CREATE EXTENSION IF NOT EXISTS vector`**
  (`backend/src/main/resources/db/migrations/V8__search_embeddings.sql:4`). On
  RDS that statement needs `rds_superuser`, which constrains which database user
  the application may connect as on a cold start. See *Design decisions*.
- Binding rules for anything touching the database:
  [`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md).

---

## Overview

CampusVibe's backend is a single Spring Boot fat jar that takes all of its
configuration from the environment. That property is what makes deployment
mostly a packaging problem rather than a code problem: the same artifact runs
under Compose locally and under Elastic Beanstalk in production, and only the
source of the values changes.

The deployment target is Elastic Beanstalk running the Docker platform on Amazon
Linux 2023, single instance, with RDS created separately so its lifecycle is not
tied to the environment. EB accepts a *source bundle* — a zip it unpacks on the
instance and builds with Docker. The entire Phase 1 packaging problem is
producing that zip with the right shape and the right contents.

The architectural idea to hold: **the build happens on the developer machine,
the run happens on AWS.** EB is given a Dockerfile that only copies a finished
jar. This keeps deploys to seconds of instance work rather than minutes, and
keeps the compiler off a box that is simultaneously serving traffic.

---

## File-by-file breakdown

### `deploy/eb/Dockerfile`

The production image. Base is `eclipse-temurin:25-jre-alpine` — a JRE, not the
JDK that `backend/Dockerfile` uses, because nothing at runtime compiles. It
creates an unprivileged `campusvibe` user, copies `app.jar` from the bundle
root, exposes 8080 to match `server.port` in `application.yml:2`, and starts the
JVM with `-XX:MaxRAMPercentage=60.0 -XX:+ExitOnOutOfMemoryError`.

It is never built directly. `scripts/package-eb.mjs` copies it into the staging
directory beside the jar, and EB builds it from there.

### `scripts/package-eb.mjs`

Builds the bundle in four steps: run `mvnw clean package -DskipTests` (skippable
with `--skip-build`, or promoted to `clean verify` with `--tests`); locate
exactly one `campusvibe-*.jar` in `backend/target`; stage that jar as `app.jar`
next to the Dockerfile; zip the staging directory to
`dist/eb/campusvibe-backend-<timestamp>-<sha>[-dirty].zip`.

It refuses to guess. If `backend/target` holds more than one matching jar it
stops and asks for a clean build rather than picking the newest — shipping a
stale artifact is a failure that survives into production and looks like a code
bug once there.

It deploys nothing. It writes a file and prints its path.

### `dist/` *(generated, gitignored)*

Build output. `dist/eb/bundle/` is the staging directory, rebuilt from scratch
each run; `dist/eb/*.zip` are the bundles. Added to `.gitignore:11`.

### Files this document does **not** describe

`docker/Dockerrun.aws.json` is a v1 single-container template left from earlier
work. It is **not** part of the source bundle produced here and is not used by
anything today; it becomes relevant only if deployment moves to an ECR-hosted
image. `docker/EB-DEPLOYMENT.md` is the environment-property reference and is
current — it is linked from above rather than restated.

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| Build the jar locally; EB only copies it | A Maven build on the target instance costs minutes of every deploy and can be killed by the OOM reaper on a 1 GiB box that is also serving traffic | The multi-stage Maven build in guide §3 | Deploys get slow and intermittently fail with no application-level cause |
| A separate `deploy/eb/Dockerfile` rather than reusing `backend/Dockerfile` | The two builds have different context roots — repo root under Compose, bundle root under EB — and one `COPY` path cannot satisfy both | Making Compose use the bundle shape | Either local Compose breaks, or every deploy uploads the whole repository |
| A script rather than documented manual steps | The bundle shape (flat, no wrapping folder) is easy to get wrong and only fails after upload | A README section | Deploy failures that cost a console round-trip each to diagnose |
| Region `ca-central-1` | Chosen by Arpan; closest region to the McGill user base | `us-east-1` | Latency, and data leaving Canada |

### Task-specific

**`-XX:MaxRAMPercentage=60.0` rather than `-Xmx`.** The target is a t3.micro
with 1 GiB. A percentage tracks the container instead of needing a hand edit
when the instance type changes. 60 rather than the more common 75 because the
JVM's non-heap footprint — metaspace, thread stacks, the AWS SDK's buffers — is
a larger share of total memory at this size. Reverting to a fixed `-Xmx` means
the value silently becomes wrong on the first resize.

**`-XX:+ExitOnOutOfMemoryError`.** Without it a JVM that has exhausted its heap
keeps answering `/actuator/health` while failing real requests, so the platform
never restarts it. With it the container dies and EB replaces it. The cost is
that a single bad request pattern can restart the process; that is the better
failure.

**Unprivileged container user.** The application binds 8080, never a low port,
so root buys nothing. Rationale is standard hardening rather than a specific
finding.

**The database user question is deferred, deliberately.** Guide §5 asks for a
dedicated application user rather than the RDS master. But Flyway V8 executes
`CREATE EXTENSION IF NOT EXISTS vector`, which requires `rds_superuser` on RDS,
and Flyway runs on every application start. On a cold database the application
must therefore connect as the master user at least once. Creating the extension
by hand first would let a lesser user through — `CREATE EXTENSION IF NOT EXISTS`
is a no-op when the extension is present, and a no-op does not check privileges
— but doing that requires `psql` access to a database that is, correctly, not
publicly reachable. The plan is to connect as master initially and revisit; it
is recorded in *Known gaps* rather than quietly dropped.

**RDS will run PostgreSQL 15.x, not 16 or 17.** Local Compose, both
Testcontainers suites and the `_database.yml` CI job all pin
`pgvector/pgvector:pg15` (`docker/docker-compose.yml:9`,
`backend/src/test/java/com/campusvibe/search/SearchIT.java:69`,
`backend/src/test/java/com/campusvibe/search/SearchRateLimitIT.java:50`,
`.github/workflows/_database.yml:130`). Matching the production major version to
the one every test actually runs against is worth more than the extra support
window a newer major would buy, and moving all four pins is a change with its
own risk — a PostgreSQL major upgrade cannot be done in place on a Docker
volume. PostgreSQL 15 reaches end of life in November 2027, so this is a
decision with an expiry date; see *Possible improvements*.

---

## Verification performed

Measured on 2026-08-18, on Windows 10 with Docker 29.4.3 and Temurin 25.0.3:

| Check | Result |
|---|---|
| Bundle builds | `dist/eb/…-d4afe79-dirty.zip`, 68.7 MB from a 77.2 MB jar |
| Zip root is flat | Entries are exactly `app.jar` and `Dockerfile`, forward-slash separators |
| Image builds from the bundle root, as EB does | `docker build dist/eb/bundle` succeeded in 6.5 s |
| Container starts under `SPRING_PROFILES_ACTIVE=prod` | `Started Main in 14.972 seconds` |
| Flyway against a real database | `Current version of schema public: 12 … no migration necessary` |
| `GET /actuator/health` | `200 {"status":"UP"}` |
| `GET /api/v1/clubs` unauthenticated | `200` |
| `DevDataSeeder` under `prod` | Did not run — no seeder output in the log |
| Optional integrations degrade rather than fail | OpenAI, Google sign-in and SMTP each logged an explicit disabled notice and the application still started |

The container ran against the local Compose PostgreSQL, not RDS. Everything
above is evidence the *artifact* is sound; none of it is evidence about AWS.

---

## Known deviations, gaps and blockers

- **Phases 2–6 are not started.** No RDS instance, no S3 bucket, no EB
  application, no IAM role, no CI/CD deployment job. The checklists in guide §23
  are the source of truth for what remains.
- **Guide §18 requires HTTPS; guide §20 and §25 forbid an Application Load
  Balancer without approval.** These conflict — an ALB with ACM is the ordinary
  way to terminate TLS on Elastic Beanstalk. The resolution chosen is Cloudflare
  in front of a single-instance environment, which keeps the environment
  single-instance and free of an ALB while still giving the browser HTTPS.
  Consequence: `AUTH_RATE_LIMIT_TRUST_XFF` must be `true` in production, because
  behind Cloudflare every request arrives from a proxy address and the rate
  limiter would otherwise treat the whole internet as one client
  (`application.yml`, `campusvibe.auth.rate-limit.trust-forwarded-header`).
- **The application will connect to RDS as the master user initially.** See the
  design decision above. Tracked in `todo.md`.
- **PostgreSQL 15 reaches end of life in November 2027.** A major-version
  upgrade is required before then, on RDS and in all four pinned images.
- **The bundle carries a 77 MB fat jar to S3 on every deploy.** Acceptable at
  this cadence; a layered image in ECR is the fix if deploys become frequent.
- **No automated test covers `package-eb.mjs`.** Its failure mode is loud and
  local, so this is judged acceptable; it is not covered by `scripts/verify.mjs`.

---

## Possible improvements

| Improvement | Trigger for doing it | Blocked on |
|---|---|---|
| Move to ECR with an immutable image tag per commit | The first time a deploy needs to be rolled back precisely, or when CI starts deploying | Nothing — Phase 6 work |
| Layered Spring Boot image (`spring-boot-jarmode=tools`) so dependencies are a cached layer | Deploy upload time becomes annoying | Nothing |
| Dedicated least-privilege database user | After the first successful production migration run | Requires `psql` reachability to a private RDS — a bastion or SSM session |
| PostgreSQL 16+ everywhere | Before November 2027, or sooner if a pgvector feature requires it | Coordinated change to four pinned images plus a local volume rebuild |
| AWS Secrets Manager instead of EB environment properties | When more than one environment exists, or when rotation needs an audit trail | Nothing — the migration path is already written up in `docker/EB-DEPLOYMENT.md` |

---

## Change log

- 2026-08-18 — Created. Phase 1 (production readiness and EB packaging) written
  from the code and from a verified local run. Phases 2–6 not started. *Claude
  (Opus 5)*
