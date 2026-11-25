# The local start script, `scripts/dev.mjs`

**Code as of:** `bb49c9e` plus `scripts/dev.mjs` (committed after it), re-read against this doc 2026-11-25. Compose's object store is `s3mock` since the same day ([ADR-026](../decisions/ADR-026-s3mock-replaces-minio.md)); nothing here names it

One command brings the whole local stack up from a fresh clone:

```bash
node scripts/dev.mjs
```

It needs Node and Docker, nothing else: no JDK, no Maven, no `JAVA_HOME`. It
prints the frontend and API addresses once both actually answer.

| Command | Effect |
|---|---|
| `node scripts/dev.mjs` | Start, building only what is missing |
| `… --jar` | Rebuild the backend jar, then start |
| `… --rebuild` | Rebuild the backend jar and every image, then start |
| `… --env-only` | Create `docker/.env` if it is missing, then stop |
| `… --stop` | Stop the containers and keep them |
| `… --down` | Remove the containers and network; the data is kept |
| `… --help` | Usage |

`--env-only`, `--stop` and `--down` each stand alone; combining one with
another option, or passing an unknown option, prints the usage and exits 1.

---

## What a start does, in order

Each step is skipped when there is nothing to do, so a second run goes almost
straight to step 7.

### 1. Docker is running

`docker info` decides. If the command is missing, the script stops and says to
install Docker Desktop. If the daemon is down:

- **Windows** — starts `Docker Desktop.exe` from `Program Files` and polls
  `docker info` every 3 seconds for up to two minutes.
- **macOS** — `open -a Docker`, then the same wait.
- **Linux** — stops and says to run `sudo systemctl start docker`. Starting a
  system service needs root, which a dev script should not ask for.

If Docker is still not ready after two minutes, the script stops with a message
rather than failing later inside a compose command with an error about a pipe
or a socket.

### 2. `docker/.env` exists

If the file is present it is used as it is and **never modified**: the script
does not merge in new variables from the template or rewrite values. It does
compare variable *names* with `docker/.env.example` and lists any the template
has that the file lacks, so a variable added to the template later is not
silently missing. Values are never printed. Until the variable is copied in,
the default in `docker-compose.yml` applies.

If it is missing, it is copied from `docker/.env.example` with two values
generated fresh by Node's `crypto.randomBytes`:

| Variable | Generated as | Why |
|---|---|---|
| `POSTGRES_PASSWORD` | 24 random bytes, hex (48 chars) | Required by compose (`${POSTGRES_PASSWORD:?…}`); any value works locally |
| `JWT_SECRET` | 32 random bytes, hex (64 chars) | Required by compose; the backend refuses to start under 32 bytes for HS256 |

Hex keeps both values safe in a `.env` file, a shell and the SQL in step 4
without any quoting. Every other line is the template's own default, so the
optional features stay in their documented off state: no OpenAI key (search in
keyword-only mode, planner answers 503), no mail host (emails are logged), no
Google client id. To turn one on, edit `docker/.env` and run the script again.

The file is written with the `wx` flag, so a file created between the check and
the write is never overwritten.

### 3. The ports are free

Compose claims each service's ports only as it starts that service, in
dependency order, and `frontend` (3000) comes last, after `db` (5332), the
object store and `backend` (8080). A taken 3000 would therefore surface only
after everything else was already running, leaving a stack with an API and no
web app.

So the script reads the published ports from `docker compose config` and tries
to bind each one, on `0.0.0.0` and on `127.0.0.1`: Docker publishes on the
first, and a stray dev server often listens only on the second. A port held by
**this project's own containers** (from `docker compose ps`) is skipped, since
compose reuses a running container rather than binding again. If anything else
holds a port, the script stops before starting anything, names the port and
the service, names the container if another Docker container holds it, and
gives the command to find the process (`netstat -ano | findstr :<port>` on
Windows, `lsof -i :<port>` elsewhere).

### 4. The database accepts the new password

Postgres applies `POSTGRES_PASSWORD` only when it initialises an **empty** data
volume. A new `.env` against an existing `db_data` volume would therefore leave
the backend failing with `28P01 password authentication failed` while the
`db` container still reports healthy (BUG-020).

So, only when step 2 just created the file and the volume already exists, the
script starts the `db` service, waits for it to be healthy, and runs

```sql
ALTER USER "$POSTGRES_USER" WITH PASSWORD '$POSTGRES_PASSWORD'
```

inside the container. Local socket connections are trusted, so the old password
is not needed and **the data is kept**. This is the same fix
`docker/.env.example` describes by hand.

If it fails, the volume was most likely created with a different
`POSTGRES_USER` or `POSTGRES_DB`. The script stops and gives the two ways out:
restore the `.env` the volume was made with, or wipe the local database with
`docker compose -f docker/docker-compose.yml down -v`. It never wipes anything
itself.

**Every checkout shares one database volume.** Compose names the project after
the folder holding the compose file, which is `docker/` in every clone and
worktree, so all of them use `docker_db_data` and the same `campusvibe-*`
containers. Starting a new worktree with no `.env` resets the shared database
to a new password, and the other checkout's `.env` stops working. Copy an
existing `docker/.env` into the new checkout before the first run.

### 5. The backend jar exists

`backend/Dockerfile` copies a prebuilt `backend/target/campusvibe-0.0.1-SNAPSHOT.jar`
instead of compiling inside the image, so without the jar the backend image
cannot build. The jar is built **only** when it is missing, or when asked for
with `--jar` or `--rebuild`.

An existing jar is never rebuilt on its own. Instead the script compares its
modification time with the newest file under `backend/src` and with
`backend/pom.xml`, and if the source is newer it warns that the backend will
run the old code and to rerun with `--jar`.

The build runs in a throwaway container rather than with `backend/mvnw`, so
the host needs no JDK:

```
docker run --rm -v <repo>/backend:/workspace -v campusvibe-maven-cache:/root/.m2 \
  -w /workspace maven:3.9.11-eclipse-temurin-25 mvn -q -B -DskipTests package
```

- **`maven:3.9.11-eclipse-temurin-25`** matches the Maven version
  `backend/.mvn/wrapper/maven-wrapper.properties` pins and the Java 25 that CI
  and `backend/Dockerfile` use. Change them together.
- **`backend/` is mounted**, so the jar lands in `backend/target/` exactly
  where a host build puts it, and `docker compose watch` picks it up from
  there.
- **`campusvibe-maven-cache`** is a named volume holding the Maven repository,
  so dependencies download once rather than on every build. Delete it with
  `docker volume rm campusvibe-maven-cache` to start clean.
- **Tests are skipped** because this is a start command; `node scripts/verify.mjs`
  is where the tests run, and that still needs a JDK on the host, as CI uses
  `setup-java`.
- **On Linux** the container runs as root and a bind mount keeps that owner,
  so the build ends with `chown` back to your user; otherwise `backend/target`
  could not be deleted without `sudo`. Docker Desktop on Windows and macOS
  maps ownership itself.

The first build pulls the image and every dependency: about two minutes on
2026-11-25. Later builds reuse both.

### 6. The images exist

If `docker compose ps -a` shows no containers for the project, or with
`--rebuild`, the script runs `docker compose build` first. Otherwise it goes
straight on and lets compose reuse the images it has.

### 7. `docker compose watch`, then *CampusVibe is up*

`watch` runs in the foreground with its output in the terminal. `watch` rather
than `up`, for the reason `CONTRIBUTING.md` gives: it syncs a rebuilt jar into
the backend container and restarts it, where a plain `up` can keep running an
old jar. Frontend source changes sync live.

Alongside it, the script polls every 3 seconds: first
`http://localhost:8080/actuator/health` until it answers, then
`http://localhost:3000` with a 60-second timeout, because `next dev` compiles
the first page on its first request. When both answer with a status below 500
it prints the two addresses. Printing them only then matters because a
container that has *started* is not yet usable: the backend runs Flyway
first. If they still do not answer after ten minutes, it says to read the
compose output instead.

**Ctrl+C** ends the watch session; the script exits with compose's own exit
code.

---

## Stopping: `--stop` and `--down`

| | `--stop` | `--down` | `down -v` (not offered) |
|---|---|---|---|
| Runs | `docker compose stop` | `docker compose down` | — |
| Containers | Stopped, kept | Removed, with the network | Removed |
| Database and uploads (the compose file's named volumes) | Kept | **Kept** | **Deleted** |
| Images and the jar | Kept | Kept | Kept |
| Next start | Restarts the same containers | Recreates them from the images, in seconds | Fresh, empty database |

Wiping the data is deliberately not a flag; it stays a command typed by hand.

Both say so and exit 0 when Docker is not running. Both work without a
`docker/.env`: compose resolves the whole file even to stop it and its `:?`
guards would refuse, so the script passes placeholder values that nothing uses.

Both act on **every checkout's** stack, since all checkouts share the project
name and containers (step 4), and the script prints that.

---

## What happens when…

| Situation | Result |
|---|---|
| Docker Desktop is closed | Started for you; the script waits up to two minutes |
| Docker is not installed | Stops at step 1 with an install message |
| First run on a fresh clone | `.env` generated, jar built, images built, stack started |
| `docker/.env` already exists | Used unchanged; no values regenerated |
| A new variable appears in `.env.example` | Named as missing at every start; copy it in by hand |
| `.env` deleted, database volume kept | New `.env`, and the role's password re-pointed to it; data kept |
| A port is taken by another program | Stops at step 3, before anything starts, naming the port |
| The stack is already running | Its ports are recognised as ours; `watch` attaches to it |
| An old stopped container lost its network | Fails at step 7 with `network … not found`; remove it with `docker rm <name>` (see *Suggested for later*) |
| Java changed | Warned at the next start; rerun with `--jar`, and `watch` swaps the new jar in |
| No JDK on the machine | Fine: the jar is built in a Maven container |

## Suggested for later

**Remove stopped containers before starting.** On 2026-11-25 the first real
run failed at step 7 with `failed to set up container networking: network …
not found`. The cause was two containers that had been stopped for two months
after another branch dropped their service, leaving them orphaned, while the
Docker network they were attached to had since been deleted and recreated.
Compose restarts an existing container as it is rather than recreating it, so
it tried to reattach them to a network that no longer existed. Removing the two
by hand with `docker rm` fixed it; compose created fresh ones and their volume
was untouched.

The fix would be one call before step 7: `docker compose rm -f`. It removes
only **stopped** containers, never running ones, and never volumes, so no data
is at risk and compose recreates whatever it removed. The cost is that
`--stop` followed by a start recreates the containers instead of restarting
them, a few seconds slower, and their logs from before the stop are lost. Not
implemented; Arpan chose to record it here first.

## Verified

On 2026-11-25:

- **Options.** `--help`; an unknown option and `--down --jar` both print the
  usage and exit 1.
- **Step 2**, in a scratch copy. `--env-only` created the file with 48- and
  64-character values and every other line identical to the template; a second
  run left it untouched; with `MAIL_FROM` and `DEV_SEED_ENABLED` deleted, the
  run named exactly those two.
- **Step 3**, against the live Docker host. With another checkout's
  `campusvibe-db` running on 5332, no conflict was reported, because the
  container belongs to the `docker` project. With a Node server listening on
  `127.0.0.1:3000` only, the script stopped naming `3000 for frontend`.
- **Step 5.** The build was run by hand with the exact image, mounts and
  command the script uses: an 81 MB jar in `backend/target/`, in 1 min 57 s
  with the image pull. With `backend/pom.xml` touched to be newer than the jar,
  the stale warning printed; with it older, nothing printed.

- **End to end.** A plain `node scripts/dev.mjs` in the worktree, with an
  existing `docker/.env` and backend jar: steps 2 to 6 passed with nothing to
  do, `watch` built and started every service, and *CampusVibe is up*
  printed with both addresses. `http://localhost:8080/actuator/health` and
  `http://localhost:3000` both answered 200. This was the second run; the first
  failed with the stale-container error under *Suggested for later*, fixed by
  hand before it.
- **Step 4**, on the first run. The worktree had no `docker/.env` and the shared
  `docker_db_data` volume existed, so the script generated a new password and
  re-pointed the database role at it. That worked, and it also locked out the
  main checkout, whose `.env` held the old password: the shared-volume caveat
  under step 4, met for real. Repaired by copying the main checkout's
  `POSTGRES_PASSWORD` into the worktree's `.env` and running the same
  `ALTER USER` again.

- **By Arpan, the same day.** Plain `node scripts/dev.mjs` runs as expected
  from both the worktree and the main checkout, and `--stop` and `--down` both
  behave as described above: `--stop` leaves the containers in place for the
  next start, `--down` removes them, and the data survives both.

Every option and every step has now been run at least once.
