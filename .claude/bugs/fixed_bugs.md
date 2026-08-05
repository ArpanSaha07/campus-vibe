# CampusVibe — Fixed Bugs

Resolved issues, kept for history. Open issues live in [`bugs.md`](bugs.md).

Last updated: **2026-08-05**

| ID | Severity | Fixed | Summary |
|---|---|---|---|
| [BUG-008](#bug-008) | Low | 2026-08-05 | `.ci/build-publish.sh` was empty; frontend CD was hard-disabled |
| [BUG-009](#bug-009) | Blocker | 2026-07-30 | Duplicate methods from merge `8f81d82` broke compilation |
| [BUG-010](#bug-010) | High | 2026-07-30 | Committed JWT fallback secret |
| [BUG-011](#bug-011) | High | 2026-07-30 | Plaintext DB password in `Dockerrun.aws.json` |
| [BUG-012](#bug-012) | High | 2026-07-30 | Compose bind-mounts shadowed the app in both containers |
| [BUG-013](#bug-013) | Medium | 2026-08-02 | `compose watch` synced into a production image, so edits never appeared |

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
