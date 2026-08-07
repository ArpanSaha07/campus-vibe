# CampusVibe — Fixed Bugs

Resolved issues, kept for history. Open issues live in [`bugs.md`](bugs.md).

Last updated: **2026-08-07**

| ID | Severity | Fixed | Summary |
|---|---|---|---|
| [BUG-017](#bug-017) | High | 2026-08-07 | `output: standalone` broke every Vercel build with an ENOENT on the trace file |
| [BUG-016](#bug-016) | High | 2026-08-07 | Production frontend image shipped the whole devDependency tree, failing the Trivy CRITICAL gate |
| [BUG-015](#bug-015) | High | 2026-08-07 | `/actuator/health` never existed; two CI jobs waited on it until timeout |
| [BUG-008](#bug-008) | Low | 2026-08-05 | `.ci/build-publish.sh` was empty; frontend CD was hard-disabled |
| [BUG-014](#bug-014) | Medium | 2026-08-05 | Google sign-in passed `client_id: undefined`, hidden by `(window as any)` |
| [BUG-009](#bug-009) | Blocker | 2026-07-30 | Duplicate methods from merge `8f81d82` broke compilation |
| [BUG-010](#bug-010) | High | 2026-07-30 | Committed JWT fallback secret |
| [BUG-011](#bug-011) | High | 2026-07-30 | Plaintext DB password in `Dockerrun.aws.json` |
| [BUG-012](#bug-012) | High | 2026-07-30 | Compose bind-mounts shadowed the app in both containers |
| [BUG-013](#bug-013) | Medium | 2026-08-02 | `compose watch` synced into a production image, so edits never appeared |

---

### BUG-017
**`output: standalone` broke every Vercel build with an ENOENT on the trace file** · High · FIXED 2026-08-07

**Found:** 2026-08-07, Vercel preview deployment of `77bd2e5` — the commit that
fixed [BUG-016](#bug-016). **A regression introduced by that fix**, caught by a
deployment path this repository does not manage and its own CI never exercises.

**Symptom:**

```
> Build error occurred
Error: ENOENT: no such file or directory, open
  '/vercel/path0/frontend/.next/next-server.js.nft.json'
Error: Command "npm run build" exited with 1
```

**Cause.** `next build` itself crashed — this is not Vercel's post-build
packaging. Traced through the installed Next 16.3.0:

- `build/index.js:2817` calls `writeStandaloneDirectory`, guarded by
  `if (config.output === 'standalone')`.
- That calls `copyTracedFiles` (`build/utils.js:1106`), which reads
  `distDir/next-server.js.nft.json` to learn which modules to copy into the
  bundle.

**That read is the standalone path's only caller.** Without
`output: standalone` the file is never opened, which is why every build before
`77bd2e5` passed. Vercel performs its own file tracing and does not leave that
artifact where the standalone step expects it, so the step ENOENTs. Next's own
documentation says standalone is a self-hosting option and is not needed on
Vercel; this is what *not needed* turns into in practice.

**A hypothesis that had to be ruled out first.** The same commit also bumped
`next` 16.2.0 → 16.3.0, so a builder incompatibility with a new minor was
equally plausible from the error text alone. Ruled out by reading the call
graph rather than guessing: the failing read sits behind the `output` check, not
behind anything version-specific. Local builds were no help — the file *is*
produced locally under standalone, so the failure does not reproduce off-Vercel.

**Fix.** `output` is now conditional on `process.env.VERCEL`, which Vercel sets
on every build:

```ts
const isVercel = Boolean(process.env.VERCEL);
output: isVercel ? undefined : "standalone",
```

Self-hosting stays the default and Vercel is the exception, deliberately. The
inverse — opting in only for Docker — would mean a plain `npm run build` no
longer produces what the image ships, and `npm start` would have no bundle to
serve.

**Verified locally, both branches:**

| Build | `.next/standalone` | Result |
|---|---|---|
| `VERCEL=1 npm run build` | absent | succeeds; trace file present and untouched |
| `npm run build` | `server.js` present, 11 packages, no `tar` | succeeds |
| Docker `--target runner` | — | boots HTTP 200, Trivy gate exit 0 |

**The wider miss this exposed.** The pipeline documentation asserted *nothing
deploys*. Vercel has been building this repository through its GitHub
integration the whole time, outside `ci.yml` and outside `ci-success`, so a
build that CI calls green can still fail there — and nothing in the repo said
so. Corrected in
[`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md). See
[BUG-018](../bugs/bugs.md#bug-018) for the gap that remains: Vercel is an
unguarded deployment surface with no build-time environment configuration
recorded anywhere.

---

### BUG-016
**Production frontend image shipped the whole devDependency tree, failing the Trivy CRITICAL gate** · High · FIXED 2026-08-07

**Found:** 2026-08-07, Docker workflow → *Scan images for known vulnerabilities*,
on the run that followed the [BUG-015](#bug-015) fix. This was the first time the
scan step had ever reached the frontend image, because the job used to die at the
health probe before getting there.

**Symptom:** three fixable CRITICALs in `campusvibe-frontend:prod`, all
`node-pkg`:

| Library | CVE | Installed | Fixed in |
|---|---|---|---|
| `swiper` | CVE-2026-27212 — prototype pollution | 12.0.2 | 12.1.2 |
| `tar` | CVE-2026-59873 — DoS via crafted gzip bomb | 7.4.3 | 7.5.19 |
| `tar` | CVE-2026-59873 | 7.5.16 | 7.5.19 |

**Cause — three separate ones wearing the same error message.** The gate printed
`Bump the base image`, which was wrong for all three:

1. **`swiper` 12.0.2** was a genuine, directly declared runtime dependency. The
   hero banner slider uses it, and the code ships to the browser. A real fix.

2. **`tar` 7.4.3** was never a runtime dependency at all. It arrives as
   `tailwindcss → @tailwindcss/postcss → @tailwindcss/node → @tailwindcss/oxide
   → tar`, marked `"dev": true` in the lockfile. It was in the production image
   only because the `runner` stage did `COPY --from=builder /app/node_modules`,
   which copies **the entire tree, devDependencies included**, into the artifact
   that would ship. A build-time archive extractor was being shipped to
   production so that Tailwind, which never runs there, could have it.

3. **`tar` 7.5.16** was not ours in any sense: it is the copy npm bundles at
   `/usr/local/lib/node_modules/npm/node_modules/tar`, inside `node:24-alpine`
   itself. Verified by inspecting the image directly — node 24.19.0 ships npm
   11.17.0, which bundles tar 7.5.16. **No published tag fixed it**:
   `node:25-alpine` is worse (npm 11.12.1, tar 7.5.11). Only npm 12.0.2 bundles
   the patched 7.5.19, and no Node release carries it yet.

**Fix.**

- `swiper` `^12.0.2` → `^12.2.0`.
- `tar` updated in place to 7.5.22 via `npm update tar`, which stays inside the
  `^7.4.3` range `@tailwindcss/oxide` declares, so nothing was overridden.
- `output: "standalone"` in `next.config.ts`, and the `runner` stage rebuilt
  around `.next/standalone` instead of a wholesale `node_modules` copy. The
  bundle carries **11 top-level packages** rather than the full tree, and `tar`
  is not among them.
- **npm deleted from the `runner` stage.** Nothing in that stage invokes it —
  the entrypoint is now plain `node server.js` — so the vendored tar goes with
  it. This is what resolved finding 3, and it is the only available answer while
  no Node tag ships a fixed npm. It is also the better answer regardless: a
  production image has no business carrying a package manager.

**A trap worth naming.** The standalone change alone would have turned the scan
green *without fixing anything*, because `swiper` has no `package.json` in the
standalone bundle — it is compiled into the client chunks — so Trivy simply stops
seeing it. The vulnerable code still reaches every visitor's browser. **Trivy no
longer has visibility into client-side dependencies of this image.** Dependabot
and `npm audit` are the controls for those now, not the image scan. Do not read a
green Trivy result as a statement about the frontend's npm tree.

**Verified locally**, each step against the real image:

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | 0 errors, 15 warnings (unchanged baseline) |
| Jest | 23/23 |
| `next build` | succeeds, 14 routes |
| Standalone bundle | 11 top-level packages, no `tar` |
| Image boots | HTTP 200 on `/`, `Ready in 0ms`, 323 MB |
| **Trivy gate, fixable CRITICAL** | **exit 0** |
| **Trivy fixable HIGH + CRITICAL** | **zero findings** |
| Gate still fires | `node:24-alpine` → exit 1, class `lang-pkgs` |

**Picked up on the way.** The HIGH report — printed but non-blocking — showed 12
findings against `next` 16.2.0, including **CVE-2026-64642, an authentication
bypass leading to unauthorized access**, fixed in 16.2.11. All 12 sat inside the
declared `^16.2.0` range, so `npm update next sharp` cleared them; that resolved
next to **16.3.0** and sharp to 0.35.3, which also cleared the one HIGH against
sharp 0.34.5 (inherited libvips CVEs). The gate never required this. Leaving a
known auth bypass in place because the gate only checks CRITICAL would have been
the wrong call.

**Two follow-on repairs, both caused by the standalone switch:**

- `next start` does not work with `output: standalone` — it boots, warns, and
  serves markup with no styles. `npm start` pointed at it. Replaced with
  `frontend/scripts/start-standalone.mjs`, which performs the two copies Next
  leaves out of the trace (`.next/static`, `public/`) and then runs `server.js`.
- That script initially failed on Windows in a way worth recording: standalone's
  `server.js` binds `process.env.HOSTNAME`, and Git Bash exports `HOSTNAME` as
  the machine name — so it bound the machine interface, `http://localhost:PORT`
  was refused, and the banner still said `Ready`. The first verification pass
  appeared to succeed only because Docker Desktop's proxy was answering on
  port 3000. The script now pins `HOSTNAME` to `127.0.0.1` unless
  `NEXT_HOSTNAME` overrides it. The Dockerfile sets it to `0.0.0.0` explicitly
  for the same reason.
- `jest-haste-map` began reporting a module naming collision between
  `package.json` and `.next/standalone/package.json` on any local run made after
  a build. Silenced with `modulePathIgnorePatterns`. CI never saw it, since
  tests run before the build there.

**Also changed:** the gate's failure message. `Bump the base image` was actively
misleading — it named the one cause that applied to none of the three findings.
It now reports the Trivy finding *class* and explains how to route `lang-pkgs`
(check the Target path: under `/app` it is ours, under
`/usr/local/lib/node_modules` it is vendored tooling) versus `os-pkgs`.

**Not verified on GitHub.** Everything above is local. The backend image was
clean in the failing run and was not re-scanned locally.

---

### BUG-015
**`/actuator/health` never existed; two CI jobs waited on it until timeout** · High · FIXED 2026-08-07

**Found:** 2026-08-07, on the first run of the pipeline after `ci/github-actions`
merged to `main` — the first time these workflows had ever executed on GitHub.

**Symptom:** two jobs failed, both on a readiness probe:

- Database → *Apply migrations to an empty schema*:
  `Timed out waiting for the application to become healthy.`
- Docker → *Wait for the backend*: `Backend never became healthy.`

Everything else in the run passed.

**Cause:** `backend/pom.xml` never declared `spring-boot-starter-actuator`. The
`management.endpoints.web.exposure.include: "health,info"` block in
`application.yml:36` was therefore inert configuration — it names endpoints that
do not exist. `SecurityFilterChainConfig.java:47` already permitted
`/actuator/**`, which made the gap easy to miss: every part of the wiring was in
place except the dependency that creates the endpoint.

Both jobs poll with `curl -fsS … | grep -q '"status":"UP"'`. With no actuator,
the request falls through to static-resource handling and the global exception
handler returns **500**:

```
{"path":"/actuator/health","message":"No static resource actuator/health.","statusCode":500}
```

`-f` makes curl exit non-zero, the loop retries, and it exhausts every attempt.
Confirmed directly against the still-running pre-fix dev container.

The failure mode is the expensive kind: the application was **completely
healthy** the whole time. Migrations applied, entities validated, `/ping` and
`/api/v1/clubs` both served. The database job burned its full 3-minute wait and
the docker job its full 200-second wait proving nothing, and reported it as an
application fault.

**Fix:** added `spring-boot-starter-actuator` to `backend/pom.xml`. No
configuration change was needed — the existing `include` and the existing
security permit were already correct and became live the moment the endpoint
existed. Exposure stays limited to `health,info`; neither
`application-prod.yml` nor `application-test.yml` widens it, so no management
endpoint beyond those two is reachable.

Both wait loops now also capture the HTTP status and report it on timeout, so a
served-but-missing endpoint is distinguishable from a connection refusal. The
docker loop additionally checks whether the container is still running and
fails immediately with logs if it is not, rather than waiting out the timeout.

**Guarded against recurrence.**
`backend/src/test/java/com/campusvibe/actuator/ActuatorHealthEndpointTest.java`
asserts `/actuator/health` returns 200 with `status: UP` for an unauthenticated
request. It is a `*Test`, not a `*IT`, so surefire runs it in the **fast tier**
and it fails on the push that breaks the contract rather than on the pull
request. It covers all three ways this can break — dependency dropped, `health`
removed from the exposure list, `/actuator/**` permit removed — none of which
produce a compile error.

A second assertion checks `/actuator/env` does **not** return 200. Because
`/actuator/**` is permitAll, anything added to
`management.endpoints.web.exposure.include` becomes publicly readable, and
`env` would leak datasource configuration. Widening that list must break a test.

**The guard was verified by breaking the code**, not just by passing: with the
dependency commented out, the test fails with
`Status expected:<200> but was:<500>` — the identical symptom CI hit — in 5.8 s
rather than a 3-minute timeout. The dependency was then restored and the full
fast tier re-run at 16/16.

**Put to use, not merely tested.** `docker/docker-compose.yml` now gives the
backend a `healthcheck` (busybox `wget`, already present in
`eclipse-temurin:25-jdk-alpine`; `start_period: 45s` so a normal slow boot never
counts as a failure), and `frontend.depends_on.backend` became
`condition: service_healthy` instead of a bare `depends_on` that waited only for
container start. Verified against an isolated compose project: the first probe
exited 1 inside the start period without counting, the second exited 0, and the
container reached `healthy`.

The dev trade-off is recorded inline in the compose file: a backend that cannot
start now blocks the frontend as well, and the escape hatch for frontend-only
work is `docker compose up db frontend`.

**Verified locally** against `pgvector/pgvector:pg15`, reproducing both jobs:

| Check | Result |
|---|---|
| First boot, empty schema | UP in ~6 s, 8 migrations applied |
| Migration history | 8 files, 8 applied, 0 failed |
| Second boot, migrated schema | UP, no re-apply, checksums valid |
| Containerised backend via `backend/Dockerfile` | UP in ~15 s |
| `GET /api/v1/clubs` | 8 clubs |
| `GET /api/v1/clubs/my-club` unauthenticated | 403 |
| Compose backend `healthcheck` | `healthy`, probes 1→0 |
| `./mvnw test` | 16/16 pass |
| Same, dependency removed | 1 failure, `expected:<200> but was:<500>` |

**Affected files:** `backend/pom.xml`,
`backend/src/test/java/com/campusvibe/actuator/ActuatorHealthEndpointTest.java`,
`docker/docker-compose.yml`,
`.github/workflows/_database.yml`, `.github/workflows/_docker.yml`

---

### BUG-008
**`.ci/build-publish.sh` is empty; frontend CD is hard-disabled** · Low · FIXED 2026-08-05

**Found:** 2026-07-30, auditing the deployment path.

**Symptom:** `.ci/build-publish.sh` was a **0-byte file**. `frontend-cd.yml:14`
set `if: false` on the deploy job, and its only remaining step generated a build
number string that no other step read — there was no Vercel or AWS deploy action.
Worse, its `workflow_run` trigger carried no branch guard, so it fired after
frontend CI passed on *any* branch. The README's claim of a CI/CD pipeline was
aspirational; nothing deployed.

**Fix:** both were **deleted** rather than implemented. CD was scoped out of the
`ci/github-actions` work deliberately — there is no AWS account, no OIDC role, no
registry, and `Dockerrun.aws.json` still carries the literal
`<your-backend-image>:latest` placeholder. A stub that lies about deploying is
worse than no stub: it makes the pipeline look finished. The prerequisites for
real CD are tracked in [`todo.md`](../TODO/todo.md) instead.

This closes the defect (dead code claiming to deploy). "Nothing deploys yet" is
not a bug — it is planned work.

**Affected files:** `.ci/build-publish.sh` (deleted),
`.github/workflows/frontend-cd.yml` (deleted)

---

### BUG-009
**Duplicate methods from merge `8f81d82` broke compilation** · Blocker · FIXED 2026-07-30

**Symptom:** the backend did not compile. `EventService` defined `delete(Long)`
and `addImages(Long, List)` twice each; `ClubService` defined
`update(String, ClubUpdateRequest)` twice. Merge artifacts from
`8f81d82 "pulling changes from feature/search and feature/authentication"`.

Undetected because backend CI runs `-DskipTests package` on the wrong JDK
([BUG-002](bugs.md#bug-002)) — the build was never actually green.

**Fix:** removed the duplicates. The two `ClubService.update` copies *differed*:
one called `searchIndexService.indexClub(club)` and one did not. The indexing
version was kept.

**Affected files:** `event/EventService.java`, `club/ClubService.java`

---

### BUG-010
**Committed JWT fallback secret** · High · FIXED 2026-07-30

**Symptom:** `application.yml:66` shipped a working default,
`campusvibe-dev-secret-0123456789-…`. Any environment that forgot to override it
signed tokens with a publicly readable key — forgeable by anyone who has seen the
repo. `docker-compose.yml` never passed `JWT_SECRET`, so the Docker stack always
used it. This failed **open**, unlike a missing OpenAI key which fails safe.

**Fix:** default removed (`secret: ${JWT_SECRET}`); `JWTUtil` now throws on a
blank or <32-byte secret; compose uses `${JWT_SECRET:?…}`. Verified: the app
refuses to start on both a blank and a short secret.

**Affected files:** `application.yml:64-67`, `jwt/JWTUtil.java`,
`docker/docker-compose.yml`, `docker/.env.example`

---

### BUG-011
**Plaintext DB password in `Dockerrun.aws.json`** · High · FIXED 2026-07-30

**Symptom:** `Dockerrun.aws.json:15` committed
`{"name": "SPRING_DATASOURCE_PASSWORD", "value": "password"}`.

**Root cause worth remembering:** the file declared `AWSEBDockerrunVersion: 2`
(multi-container/ECS), a platform where **EB environment properties are not
injected into containers** — values must be hardcoded in `containerDefinitions`.
The hardcoded secret was a consequence of the platform choice, not carelessness.
That platform is also retired.

**Fix:** converted to Dockerrun **v1** (single-container), where EB environment
properties arrive as real OS environment variables and Spring reads them
natively. All hardcoded values removed. Documented in `docker/EB-DEPLOYMENT.md`.

**Affected files:** `docker/Dockerrun.aws.json`, `docker/EB-DEPLOYMENT.md`,
`backend/src/main/resources/application-prod.yml`

---

### BUG-012
**Compose bind-mounts shadowed the app in both containers** · High · FIXED 2026-07-30

**Symptom:** the backend container could not start at all. `backend/Dockerfile:6`
copies the jar to `/app/app.jar`, but compose mounted `../backend:/app` over it,
hiding the jar (`Unable to access jarfile app.jar`). The frontend had the same
problem: `../frontend:/app` hid the built `.next` and `node_modules`. Neither
mount provided hot reload, since both images run production builds.

Also fixed alongside: the backend's `ports` and `depends_on` were commented out,
so the backend was unreachable from the host.

**Fix:** both bind-mounts removed; ports and the `depends_on` healthcheck
condition restored. Verified: backend boots and serves
`/api/v1/clubs/search?q=coding`.

**Affected files:** `docker/docker-compose.yml`

**Follow-up:** the observation above — *"neither mount provided hot reload, since
both images run production builds"* — went unaddressed, and the later
`develop.watch` attempt hit exactly that wall. See [BUG-013](#bug-013).

---

### BUG-013
**`compose watch` synced into a production image, so edits never appeared** · Medium · FIXED 2026-08-03

**Symptom:** editing `frontend/app/(main)/page.tsx` produced no change at
`localhost:3000`, despite a `develop.watch` block on the `frontend` service.

**Three independent causes, each sufficient on its own:**

1. **Nothing was compiling.** `frontend/Dockerfile` ran `npm start`
   (`next start`) under `NODE_ENV=production`, which serves the pre-built
   `.next` output. A sync into that container changes nothing, because no
   compiler is watching. The runner stage does not even contain the source tree
   — it copies only `.next`, `public`, `package.json` and `node_modules`, so the
   synced files landed in a directory Next never reads. **This is the primary
   cause**, and it is the unaddressed follow-up from [BUG-012](#bug-012).
2. **Wrong sync target.** `path: ../frontend/app` → `target: /app` maps
   `frontend/app/(main)/page.tsx` onto `/app/(main)/page.tsx`. WORKDIR is `/app`
   and the router lives at `/app/app`, so every file arrived one directory too
   high.
3. **Wrong rebuild path.** Watch paths resolve relative to the **compose file**,
   not the build context, so `path: package.json` pointed at
   `docker/package.json`, which does not exist. That rule could never fire.

**Not a cause:** `develop.watch` is already per-service, so a frontend rule was
never able to restart the backend container.

**Fix:** added a `dev` stage to `frontend/Dockerfile` running `next dev`, plus a
shared `deps` stage so dev and production install once; `runner` stays last and
therefore remains the default build target. Compose selects it with
`build.target: dev`. Rewrote the watch rules and gave `backend` and `db` their
own.

Backend uses `sync+restart` on `backend/target/*.jar` rather than `rebuild`,
because `build.context` is the repo root with no `.dockerignore` — a rebuild
would re-send `node_modules`, `target/` and `.git` on every change. Flyway
migrations ship inside the jar, so they ride along with it.

**Verified:** dev image builds; `next dev` boots (`✓ Ready in 746ms`) and serves
HTTP 200; a file copied into the running container triggers
`✓ Compiled in 108ms`, which confirms inotify fires for compose-synced writes and
that no polling env vars are needed. `docker compose config` resolves all six
watch rules to real absolute paths.

**Affected files:** `frontend/Dockerfile`, `docker/docker-compose.yml`

---

### BUG-014
**Google sign-in passed `client_id: undefined`, hidden by `(window as any)`** · Medium · FIXED 2026-08-05

**Found:** 2026-08-05, while fixing the 5 eslint errors so lint could gate merges
(CI plan step 5). Not found by reading the file — found by `tsc` the moment the
`any` was removed.

**Symptom:** `OAuthButtons.tsx` reached the Google Identity Services library
through `(window as any).google`, so every argument to `initialize()` and
`renderButton()` was unchecked. `client_id` was passed
`process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`, typed `string | undefined`. The
effect does guard with `if (!clientId) return;`, but that narrowing does not
reach the nested `init()` closure, so the value TypeScript saw there was still
possibly `undefined`.

This is worse than a normal type hole because **GIS silently ignores keys it does
not recognise and options it cannot use** — there is no exception and no console
error. The failure mode is a sign-in button that simply never renders, which
looks identical to the "Google sign-in not configured" path the component already
has for a missing client id.

**Fix:** added `frontend/app/types/google-identity.d.ts` declaring only the GIS
surface this app actually calls (`initialize`, `renderButton`, the credential
response) plus a `Window.google?: GoogleIdentityServices` augmentation — optional,
because the global exists only after the remote script loads. Replaced both
`(window as any)` casts and the `callback: (response: any)` parameter, which now
infers. Re-bound `clientId` to a local `const` after the guard so `init()` sees a
`string`.

Value beyond the lint fix: a typo in any GIS option name is now a compile error
rather than a silent no-op.

**Affected files:** `frontend/app/components/auth-components/OAuthButtons.tsx`,
`frontend/app/types/google-identity.d.ts` *(new)*
