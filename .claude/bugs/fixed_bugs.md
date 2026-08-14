# CampusVibe — Fixed Bugs

Resolved issues, kept for history. Open issues live in [`bugs.md`](bugs.md).

Last updated: **2026-08-13**

| ID | Severity | Fixed | Summary |
|---|---|---|---|
| [BUG-022](#bug-022) | High | 2026-08-13 | Copilot Autofix answered a CodeQL note by detaching `savedEventIds` from Hibernate, silently discarding every saved event |
| [BUG-021](#bug-021) | Low | 2026-08-13 | Stale Turbopack cache in the frontend container served pre-edit CSS, so new styles silently did nothing |
| [BUG-020](#bug-020) | High | 2026-08-12 | Changing `POSTGRES_PASSWORD` in `.env` locked the backend out of the existing volume (28P01) |
| [BUG-019](#bug-019) | High | 2026-08-07 | Backend jar shipped Tomcat and Spring Security with four CRITICAL CVEs |
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

### BUG-022
**Copilot Autofix detached `savedEventIds` from Hibernate, silently discarding every saved event** · High · FIXED 2026-08-13

**Found:** 2026-08-13 on PR #27 (`develop` → `main`), reviewing why GitHub Advanced
Security was objecting to the merge.

**Symptom:** saving an event did nothing. `POST /api/v1/users/me/saved-events`
answered `204 No Content`, the transaction committed, and the row never appeared.
No exception, no log line. RSVPing still worked, which made it look like a
My-events display bug rather than a write bug.

CI had already caught it — `Backend / Build and test` passed on run
`31761396279` and failed on `31761398442`, the next commit:

```
[ERROR] Tests run: 32, Failures: 2 -- com.campusvibe.user.MyEventsIT
  savingAndRsvpingSetIndependentFlags:72  Expected: a collection with size <3>
  savingTheSameEventTwiceIsANoOp:121      Expected: a collection with size <1>
```

**Cause:** commit `1562eae`, accepted from Copilot Autofix to clear CodeQL alert
21 (`java/internal-representation-exposure` on `User.getSavedEventIds`). It
suppressed Lombok's accessor and hand-wrote a defensive copy:

```java
public Set<Long> getSavedEventIds() {
    return new HashSet<>(savedEventIds);   // a throwaway copy
}
```

That is correct advice for a value object and wrong for a JPA entity. Hibernate
replaces an `@ElementCollection` field with a `PersistentSet` that records each
add and remove so it can emit SQL at flush. The service mutated through the
getter — `requireUser(email).getSavedEventIds().add(eventId)` — so post-fix the
`add` landed on a `HashSet` that was garbage-collected at the closing brace.
The generated setter was worse: reassigning the field swaps the `PersistentSet`
out, forcing a delete-and-reinsert of every row (and on an `@OneToMany` with
`orphanRemoval`, an outright throw).

Only `savedEventIds` was touched, which is why RSVPs kept working, and why moving
`goingEventIds` down three lines made CodeQL re-report it as a *new* alert 22.

**The alert was a code-quality note, not a vulnerability** — `severity: note`,
`security_severity_level: null`, no CVSS. The two genuinely high-severity alerts
in the same list (`java/spring-disabled-csrf-protection` on
`SecurityFilterChainConfig.java:37`, and `js/empty-password-in-configuration-file`)
were pre-existing on `main` and are untouched by this.

**Fix:** hand out an unmodifiable *view* and route every change through a named
mutator, applied to `savedEventIds`, `goingEventIds` and `roles`:

```java
public Set<Long> getSavedEventIds() {
    return Collections.unmodifiableSet(savedEventIds);   // wraps the live PersistentSet
}
public void addSavedEvent(Long eventId)    { savedEventIds.add(eventId); }
public void removeSavedEvent(Long eventId) { savedEventIds.remove(eventId); }
```

The field is never reassigned and mutations reach the `PersistentSet`, so dirty
checking still works, while `getRoles().add(...)` now throws
`UnsupportedOperationException` instead of quietly doing nothing. Seven call
sites moved to the mutators: `MyEventService` (4), `AuthenticationService:60,80`,
`ClubAdminRequestService:70`, plus three test helpers.

`roles` was included deliberately even though its alert (16) predates this PR: it
is the security principal, and the same autofix there would have produced
role-less registrations and silently failed club-admin promotions — a worse
outcome than a lost bookmark.

**Verification:** `./mvnw -B verify` — 21 unit + 32 integration tests, 0 failures.
`MyEventsIT` back to 6/6. The roles path was already covered and stayed green:
`AuthenticationFlowIT` asserts `$.user.roles` and the JWT claim after register
(`:36`, `:44`), and `ClubAdminRequestFlowIT:63` asserts `hasRole` on a **reloaded**
user, which is what proves persistence rather than in-memory state.

**Prevention:** `backend/src/test/java/com/campusvibe/user/UserTest.java` pins the
decision — it asserts each getter throws on mutation, and that the view reflects a
later `addSavedEvent`, so it fails against *both* the plain Lombok getter and the
copy. The comment above the accessors in `User.java` says why, because the next
person to meet this will be reading that file with an autofix button in front of
them. [BUG-023](bugs.md#bug-023) tracks the same trap still armed on
`Club.images` and `Event.images`.

**Open question:** whether `Collections.unmodifiableSet` actually clears alerts
20/21/22. It is the remedy CodeQL's own help text recommends and the query uses
value dataflow rather than taint, so it should — but the arbiter is the re-scan on
push, not this reasoning. If the alerts survive, the fallback is one line: return
the copy from the getter and keep the mutators, which fixes the data loss either
way.

---

### BUG-021
**Stale Turbopack cache in the frontend container served pre-edit CSS** · Low · FIXED 2026-08-13

**Found:** 2026-08-13. The My clubs cards stopped drifting on hover. `globals.css` still
held `.lift-tr`, `MyClubCard.tsx` still carried the class, and nothing in `git diff`
explained it.

**Symptom:** the stylesheet Next actually served was the version from *before* the
`.lift-tr` edit — the rule was absent entirely, and the `prefers-reduced-motion` block
still listed only the original two selectors:

```
$ curl -s http://localhost:3000/_next/static/chunks/'[root-of-the-server]__0oeaxs7._.css' | grep lift
2835:.lift {
2839:.lift:hover {
2849:  .lift, .lift:hover {
```

while inside the container the source was current (`grep -c lift-tr app/globals.css` → 6).
Source and served output disagreed, which is why reading the code proved nothing.

**Cause:** `.next/` lives in the container's writable layer, and `docker compose up -d` on
an existing stopped container **starts it rather than recreating it**, so that directory
survives. The container here had been created on 2026-08-10; `next dev` restarted today at
13:11 on top of a three-day-old Turbopack persistent cache and reused the CSS chunk it
found there instead of recompiling from the newer file synced in at 13:01.

The frontend service deliberately has **no bind-mount** — `develop.watch` syncs source in
instead, to avoid the slow Windows bind-mount into the VM (`docker-compose.yml:112-170`).
That is the right trade-off, but it means the container's idea of the source and its cache
can drift apart in a way a bind-mounted setup would not.

**Fix:** drop the cache and restart.

```sh
docker exec campusvibe-frontend rm -rf .next
docker restart campusvibe-frontend
```

**Verification:** the served chunk then contained `.lift-tr`, `.lift-tr:hover,
.lift-tr:focus-visible`, and the five-selector reduced-motion block. Measured in headless
Chromium on `/my-clubs`: resting `transition-duration: 0.22s`, hover transform
`matrix(1, 0, 0, 1, 8, -8)`, 6.8px of it already travelled 80ms in (so it eases rather
than jumps), and `:focus-visible` producing the same transform.

**Prevention:** when a CSS or config edit appears to have no effect, diff the *served*
asset against the source before touching the code — the same class of mistake as
[BUG-013](#bug-013), where `compose watch` synced into an image that could not recompile.
Remember that plain `docker compose up -d` does not re-sync source into an existing
container; `docker compose watch` is what propagates edits, and a container restart alone
keeps whatever cache was already there.

---

### BUG-020
**Changing `POSTGRES_PASSWORD` in `.env` locked the backend out of the existing volume** · High · FIXED 2026-08-12

**Found:** 2026-08-12, after rotating the local Postgres password in `docker/.env`.
`campusvibe-db` came up healthy, `campusvibe-backend` exited 1 during Flyway's very
first connection attempt.

**Symptom:**

```
SQL State  : 28P01
Message    : FATAL: password authentication failed for user "arpan"
```

The confusing part is that `db` reported **healthy** throughout. Its healthcheck is
`pg_isready`, which only asks whether the server accepts connections — it never
authenticates, so a password mismatch is invisible to it. Compose therefore satisfied
`depends_on: service_healthy` and started the backend straight into the failure.

**Cause:** `POSTGRES_PASSWORD` is read by the Postgres image's entrypoint **only when it
runs `initdb` on an empty data directory**. The `docker_db_data` volume was initialized
under the old password, so the `arpan` role kept the old SCRAM verifier while
`SPRING_DATASOURCE_PASSWORD` (`docker-compose.yml:56`) now carried the new one. Compose
did recreate the `db` container on the next `up` — its `POSTGRES_PASSWORD` env var
matched `.env` exactly — but a recreated *container* over a pre-existing *volume* changes
nothing about the role that already exists inside the database. The env var is an init
input, not a desired-state declaration.

**Fix:** reset the role in place, over the container's Unix socket. The image's generated
`pg_hba.conf` keeps `local all all trust`, so the forgotten old password was not needed:

```sh
docker exec campusvibe-db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '"'"'$POSTGRES_PASSWORD'"'"'"'
```

Both variables expand *inside* the container, so the value comes from the env Compose
already injected from `.env` and the secret never lands in host argv or shell history.
Postgres 15 defaults `password_encryption` to `scram-sha-256`, matching the
`host all all all scram-sha-256` line the image appends, so the new verifier was usable
by the JDBC driver immediately.

Rejected the obvious alternative, `docker compose down -v`: it re-runs `initdb` with the
new password and Flyway rebuilds the schema, but it drops the volume — 8 clubs and 1 user
here, none of it reproducible from migrations.

Verified with a TCP login (`PGPASSWORD=… psql -h 127.0.0.1`), which is the path the
backend actually uses rather than the trust-based socket, then `compose up -d`: backend
`Up (healthy)`, `/actuator/health` `{"status":"UP"}`, Flyway logged *Current version of
schema "public": 8 — no migration necessary*, and `clubs` still held 8 rows.

Also documented the one-shot nature of the variable in `docker/.env.example`, since
nothing at the point of edit hinted that changing it would not take effect.

**Affected files:** `docker/.env.example` *(comment only — the fix itself was a one-off
database command, no application or compose change)*

---

### BUG-019
**Backend jar shipped Tomcat and Spring Security with four CRITICAL CVEs** · High · FIXED 2026-08-07

**Found:** 2026-08-07, Docker workflow → *Scan images for known vulnerabilities*,
the run after [BUG-016](#bug-016). The frontend image came back clean, so the gate
moved on to the backend and failed there.

**Symptom:** four fixable CRITICALs, every one `jar`, every one inside
`app/app.jar`. The `alpine 3.23.5` layer reported **0** — this is `lang-pkgs`,
not the base image, which is exactly the distinction the gate message rewritten
in BUG-016 was added to draw.

| Library | CVE | Installed | Fixed in |
|---|---|---|---|
| `tomcat-embed-core` | CVE-2026-41293 — HTTP/2 request headers not validated | 10.1.44 | 10.1.55 |
| `tomcat-embed-core` | CVE-2026-43512 — authentication bypass via digest authentication | 10.1.44 | 10.1.55 |
| `tomcat-embed-core` | CVE-2026-43515 — improper authorization allows security bypass | 10.1.44 | 10.1.55 |
| `spring-security-web` | CVE-2026-22732 — security policy bypass and information disclosure | 6.5.3 | 6.5.9 |

**Cause.** Neither library appears in `pom.xml`. Both arrive transitively through
`spring-boot-starter-web` and `-starter-security`, and both versions are dictated
by `spring-boot-starter-parent`, which was pinned at **3.5.5**. That BOM manages
tomcat 10.1.44 and spring-security 6.5.3, so the jar ships them regardless of
anything this repository declares. **The parent version is the only lever** — a
direct dependency bump would be overridden by the BOM, and overriding
`<tomcat.version>` by hand would leave the rest of the tree on 3.5.5's matrix.

Worth naming because it changes how this reads: **the image did not get worse,
the database did.** BUG-016 recorded the backend image as clean one run earlier,
on this same 3.5.5 jar. Nothing in the repo changed between those runs — these
are newly published advisories, not newly *reached* ones. Anything that pins a
framework version is on a clock it does not control.

**Fix.** Parent `3.5.5` → **3.5.16**, picked as the *floor* rather than as
"latest":

| Boot | tomcat | spring-security | Clears the gate |
|---|---|---|---|
| 3.5.5 | 10.1.44 | 6.5.3 | no |
| 3.5.12 | 10.1.52 | 6.5.9 | spring-security only |
| 3.5.14 | 10.1.54 | 6.5.10 | spring-security only |
| **3.5.16** | **10.1.55** | **6.5.11** | **yes** |

Staying on the 3.5 line is deliberate. It is a patch-level move within a minor,
so no API surface shifts and no migration reading is required. Boot **4.1.0**
exists and is what Dependabot `#17` proposes; that is a major, it fails both CI
tiers today, and taking it as a CVE remedy would mean debugging a framework
migration against a security deadline. A comment on the `<version>` element
records that 3.5.16 is a floor, so that a later tidy-up downward does not quietly
reintroduce four CRITICALs.

**Verified locally:**

| Check | Result |
|---|---|
| `./mvnw -B verify -DskipITs` | BUILD SUCCESS, 16/16 unit tests |
| `dependency:list` | `tomcat-embed-core` **10.1.55**, `spring-security-web`/`-core` **6.5.11** |
| Fat jar contents | `BOOT-INF/lib/tomcat-embed-core-10.1.55.jar`, `spring-security-web-6.5.11.jar` |

The evidence above is **version identity** — every installed version meets or
exceeds the *Fixed Version* Trivy named. Strong for these four findings, silent
about any fifth, so it needed the gate itself to confirm it.

**Confirmed against the gate, 2026-08-08**, once Docker Desktop was running. The
whole `_docker.yml` sequence was replayed locally with Trivy **0.73.0** — the
same version `install.sh` fetches today, run from the `aquasec/trivy` image
against the daemon rather than installed to `/usr/local/bin`:

| Workflow step | Result |
|---|---|
| Compose fail-fast secret guard | refuses to produce a config; names `POSTGRES_PASSWORD` |
| `compose build` + `up -d` | db healthy, backend **UP**, frontend serving |
| API smoke tests | `/ping` ok · `/api/v1/clubs` **8** · search **1** hit · `/my-club` **403** |
| Production frontend image | builds, serves `/` on :3001 |
| **Gate — fixable CRITICAL** | **backend 0** (alpine **0**, `app/app.jar` **0**) · **frontend 0** · **exit 0** |

So the four findings are gone from the artifact the gate actually scans, not
merely from the dependency tree. `trivy fs` against the bare jar, tried while
Docker was down, was never evidence of this: it reported
`Number of language-specific files num=0` and scanned nothing, so a green result
there would have meant only that it looked at nothing.

**The fixable-HIGH report has now been read** — that was the open question, and
the answer is that the backend image is **not** clean at HIGH. Ten findings, none
of which the CRITICAL gate can see:

| Class | Library | CVE | Installed | Fixed in | Whose to fix |
|---|---|---|---|---|---|
| `os-pkgs` | `libexpat` | CVE-2026-56408 | 2.8.1-r0 | 2.8.2-r0 | `eclipse-temurin:25-jdk-alpine` |
| `os-pkgs` | `p11-kit`, `p11-kit-trust` | CVE-2026-2100 | 0.25.5-r2 | 0.26.2-r0 | same base image |
| `lang-pkgs` | `commons-io` | CVE-2024-47554 | 2.11.0 | 2.14.0 | **ours** — hard-pinned in `pom.xml` |
| `lang-pkgs` | `netty-codec` | CVE-2026-59901 | 4.1.135.Final | 4.1.136.Final | BOM |
| `lang-pkgs` | `netty-codec-http` | CVE-2026-55831, -55833, -56745 | 4.1.135.Final | 4.1.136.Final | BOM |
| `lang-pkgs` | `netty-codec-http2` | CVE-2026-56819 | 4.1.135.Final | 4.1.136.Final | BOM |
| `lang-pkgs` | `org.postgresql:postgresql` | CVE-2026-54291 | 42.7.11 | 42.7.12 | BOM |

The production frontend image reports **0 HIGH and 0 CRITICAL**, holding the
BUG-016 result.

Two things this measurement settles. First, **tightening the gate to HIGH would
fail today** — that task's precondition is now measured rather than assumed, and
the answer is "not yet". Second, **netty is in the jar by accident**:
`dependency:tree` shows all five netty artifacts arriving through
`software.amazon.awssdk:s3` → `netty-nio-client`, the SDK's *async* transport.
The version is Boot's (the BOM overrides what awssdk 2.20.26 asks for), so the
CVEs are real, but if the S3 client here is the synchronous one then six of the
ten HIGHs belong to a transport nothing calls, and an `<exclusion>` removes them
outright. Worth establishing before bumping anything.

**Deliberately left alone:** the hard-pinned block outside the BOM —
`software.amazon.awssdk:s3` 2.20.26, `commons-io` 2.11.0, `jjwt` 0.11.5, and the
three Google client libraries. Only `commons-io` surfaced above, and none of them
reached the CRITICAL gate. These are what Dependabot's maven entry exists for.

**Overlaps a Dependabot PR.** `#15` (`maven-minor-patch`, 7 updates) almost
certainly carries this same parent bump plus six others, and is currently red in
both tiers. This change is the minimum that clears the gate and does not settle
`#15`, which still needs triage on its own merits.

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
