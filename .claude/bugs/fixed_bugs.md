# CampusVibe — Fixed Bugs

Resolved issues, kept for history. Open issues live in [`bugs.md`](bugs.md).

Last updated: **2026-07-30**

| ID | Severity | Fixed | Summary |
|---|---|---|---|
| [BUG-009](#bug-009) | Blocker | 2026-07-30 | Duplicate methods from merge `8f81d82` broke compilation |
| [BUG-010](#bug-010) | High | 2026-07-30 | Committed JWT fallback secret |
| [BUG-011](#bug-011) | High | 2026-07-30 | Plaintext DB password in `Dockerrun.aws.json` |
| [BUG-012](#bug-012) | High | 2026-07-30 | Compose bind-mounts shadowed the app in both containers |

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
