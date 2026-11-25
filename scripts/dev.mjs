#!/usr/bin/env node
/**
 * Start the whole local stack with one command:
 *
 *   node scripts/dev.mjs              start, building only what is missing
 *   node scripts/dev.mjs --jar        rebuild the backend jar, then start
 *   node scripts/dev.mjs --rebuild    rebuild the backend jar and every image, then start
 *   node scripts/dev.mjs --env-only   create docker/.env if missing, then stop
 *   node scripts/dev.mjs --stop       stop the containers, keep them
 *   node scripts/dev.mjs --down       remove the containers; data volumes are kept
 *
 * What a start does, in order — each step is skipped when there is nothing to do:
 *
 *   1. Docker is running. If the daemon is down it starts Docker Desktop
 *      (Windows, macOS) and waits up to two minutes; on Linux it says how.
 *   2. docker/.env exists. If not, it is copied from docker/.env.example with
 *      POSTGRES_PASSWORD and JWT_SECRET generated fresh. An existing file is
 *      never touched, but variables the template has and it lacks are named.
 *   3. The published ports are free, or held by this project's own containers.
 *   4. The database volume accepts that password. A new password and an old
 *      volume disagree (BUG-020), so the role's password is reset to match,
 *      keeping the data.
 *   5. The backend jar exists. backend/Dockerfile copies a prebuilt jar
 *      rather than compiling, so with no jar the image cannot build. It is
 *      built in a throwaway Maven container, so no JDK is needed on the host,
 *      and only when missing or asked for with --jar or --rebuild. A jar older
 *      than the Java source is reported, not rebuilt.
 *   6. Images exist. With no containers yet, `docker compose build` runs first.
 *   7. `docker compose watch` runs in the foreground until Ctrl+C, and the
 *      URLs are printed once the backend and frontend actually answer.
 *
 * How it works and why: docs/architecture/dev-script.md.
 */

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCKER_DIR = join(ROOT, "docker");
const COMPOSE_FILE = join(DOCKER_DIR, "docker-compose.yml");
const ENV_FILE = join(DOCKER_DIR, ".env");
const ENV_EXAMPLE = join(DOCKER_DIR, ".env.example");
const BACKEND = join(ROOT, "backend");
// Must match the COPY in backend/Dockerfile and the watch path in compose.
const JAR = join(BACKEND, "target", "campusvibe-0.0.1-SNAPSHOT.jar");
const WIN = process.platform === "win32";
// Maven 3.9.11 is what backend/.mvn/wrapper pins; Java 25 is what CI's
// setup-java and backend/Dockerfile use. Change all three together.
const MAVEN_IMAGE = "maven:3.9.11-eclipse-temurin-25";
// Named volume holding ~/.m2, so dependencies download once, not every build.
const MAVEN_CACHE = "campusvibe-maven-cache";
const BACKEND_HEALTH = "http://localhost:8080/actuator/health";
const FRONTEND_URL = "http://localhost:3000";

const USAGE = `Usage: node scripts/dev.mjs [--jar | --rebuild]
       node scripts/dev.mjs --env-only | --stop | --down
See docs/architecture/dev-script.md.`;

const KNOWN = new Set(["--jar", "--rebuild", "--env-only", "--stop", "--down", "--help", "-h"]);
const FLAGS = new Set(process.argv.slice(2));
for (const flag of FLAGS) {
  if (!KNOWN.has(flag)) {
    console.error(`Unknown option ${flag}\n${USAGE}`);
    process.exit(1);
  }
}
const ACTIONS = ["--env-only", "--stop", "--down"].filter((flag) => FLAGS.has(flag));
if (ACTIONS.length > 1 || (ACTIONS.length === 1 && (FLAGS.has("--jar") || FLAGS.has("--rebuild")))) {
  console.error(`${ACTIONS.join(", ")} cannot be combined with other options.\n${USAGE}`);
  process.exit(1);
}
const REBUILD = FLAGS.has("--rebuild");
const REBUILD_JAR = REBUILD || FLAGS.has("--jar");

// --- output -----------------------------------------------------------------

function step(message) {
  console.log(`\n\u25b8 ${message}`);
}

function warn(message) {
  console.log(`\n\u26a0 ${message}`);
}

function fail(message) {
  console.error(`\n\u2716 ${message}`);
  process.exit(1);
}

// --- process helpers --------------------------------------------------------

/** Run `docker compose -f docker/docker-compose.yml …`. */
function compose(args, { capture = false, env } = {}) {
  return spawnSync("docker", ["compose", "-f", COMPOSE_FILE, ...args], {
    cwd: ROOT,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
}

/** `docker compose ps --format json` prints an array or one object per line, by version. */
function parseJsonLines(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

let resolvedConfig;
/** The resolved compose file. Needs docker/.env, because of the ${VAR:?} guards. */
function composeConfig() {
  if (!resolvedConfig) {
    const res = compose(["config", "--format", "json"], { capture: true });
    if (res.status !== 0) fail(`docker compose config failed:\n${res.stderr}`);
    resolvedConfig = JSON.parse(res.stdout);
  }
  return resolvedConfig;
}

function dockerIsUp() {
  const res = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (res.error && res.error.code === "ENOENT") {
    fail("Docker is not installed, or `docker` is not on PATH. Install Docker Desktop, then run this again.");
  }
  return res.status === 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 1. Docker --------------------------------------------------------------

async function ensureDocker() {
  if (dockerIsUp()) return;

  step("Docker is not running. Starting it…");
  if (WIN) {
    const exe = join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe");
    if (!existsSync(exe)) fail(`Docker Desktop was not found at ${exe}. Start Docker yourself, then run this again.`);
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", ["-a", "Docker"], { detached: true, stdio: "ignore" }).unref();
  } else {
    fail("The Docker daemon is not running. Start it (usually `sudo systemctl start docker`), then run this again.");
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await sleep(3_000);
    if (dockerIsUp()) {
      console.log("  Docker is up.");
      return;
    }
  }
  fail("Docker did not become ready within two minutes. Check Docker Desktop, then run this again.");
}

// --- 2. docker/.env ---------------------------------------------------------

/** Replace `KEY=…` on its own line, failing loudly if the template lost the key. */
function setVar(text, key, value) {
  const line = new RegExp(`^${key}=.*$`, "m");
  if (!line.test(text)) fail(`docker/.env.example has no ${key}= line; cannot generate it.`);
  return text.replace(line, `${key}=${value}`);
}

/** Returns true when it created the file. */
function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    step("Using the existing docker/.env.");
    return false;
  }
  if (!existsSync(ENV_EXAMPLE)) fail("docker/.env.example is missing; cannot create docker/.env.");

  step("No docker/.env yet. Creating it from docker/.env.example…");
  let text = readFileSync(ENV_EXAMPLE, "utf8");
  // Hex only, so neither value needs quoting in .env, a shell or SQL.
  text = setVar(text, "POSTGRES_PASSWORD", randomBytes(24).toString("hex"));
  // 32 bytes is the HS256 minimum the backend enforces at startup.
  text = setVar(text, "JWT_SECRET", randomBytes(32).toString("hex"));
  writeFileSync(ENV_FILE, text, { encoding: "utf8", flag: "wx" });
  console.log("  Generated POSTGRES_PASSWORD and JWT_SECRET. Everything else keeps the template's value.");
  return true;
}

/** Variable names assigned on an uncommented line. */
function varNames(text) {
  return new Set([...text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)].map((match) => match[1]));
}

/**
 * An existing docker/.env is never rewritten, so a variable added to the
 * template later never reaches it. Name the gap; never print a value.
 */
function reportMissingVars() {
  if (!existsSync(ENV_EXAMPLE)) return;
  const have = varNames(readFileSync(ENV_FILE, "utf8"));
  const missing = [...varNames(readFileSync(ENV_EXAMPLE, "utf8"))].filter((name) => !have.has(name));
  if (missing.length === 0) return;
  warn(
    `docker/.env lacks ${missing.length} variable(s) that docker/.env.example has:\n` +
      missing.map((name) => `    ${name}`).join("\n") +
      "\n  The compose defaults apply until you copy them in from docker/.env.example.",
  );
}

// --- 3. ports ---------------------------------------------------------------

/** Resolve true when nothing is listening on host:port. */
function canBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host, exclusive: true });
  });
}

/**
 * Compose claims each port as it starts that service, so a taken 3000 is only
 * found after the database, the object store and the backend are already up.
 * Check first.
 * A port held by this project's own containers is fine: compose reuses them.
 */
async function checkPorts() {
  const wanted = new Map(); // port -> service
  for (const [service, def] of Object.entries(composeConfig().services ?? {})) {
    for (const mapping of def.ports ?? []) {
      if (mapping.published) wanted.set(Number(mapping.published), service);
    }
  }

  const ours = new Set();
  const ps = compose(["ps", "--format", "json"], { capture: true });
  if (ps.status === 0) {
    for (const container of parseJsonLines(ps.stdout)) {
      for (const publisher of container.Publishers ?? []) {
        if (publisher.PublishedPort) ours.add(publisher.PublishedPort);
      }
    }
  }

  const taken = [];
  for (const [port, service] of wanted) {
    if (ours.has(port)) continue;
    // Docker publishes on 0.0.0.0; a dev server often binds 127.0.0.1 only.
    // Either one being taken blocks compose.
    if ((await canBind(port, "0.0.0.0")) && (await canBind(port, "127.0.0.1"))) continue;
    const holder = spawnSync("docker", ["ps", "--filter", `publish=${port}`, "--format", "{{.Names}}"], {
      encoding: "utf8",
    }).stdout?.trim();
    taken.push(`    ${port} for ${service}` + (holder ? `, held by the container ${holder}` : ""));
  }
  if (taken.length === 0) return;

  const find = WIN ? "netstat -ano | findstr :<port>" : "lsof -i :<port>";
  fail(
    `These ports are taken by something other than CampusVibe:\n${taken.join("\n")}\n` +
      `  Free them and run this again. To see what holds one: ${find}`,
  );
}

// --- 4. database password ---------------------------------------------------

/**
 * POSTGRES_PASSWORD is applied only when Postgres initialises an empty volume.
 * A freshly generated password against a volume that already exists would
 * leave the backend failing with 28P01 while the db still reports healthy
 * (BUG-020). Local socket auth is trust, so the role can be re-pointed at the
 * new password without knowing the old one — the data stays.
 */
function syncDbPassword() {
  const volume = `${composeConfig().name}_db_data`;
  const exists = spawnSync("docker", ["volume", "inspect", volume], { stdio: "ignore" }).status === 0;
  if (!exists) return;

  step(`The database volume ${volume} predates this docker/.env. Setting its password to the new one (data is kept)…`);
  // Every checkout of the repo shares this volume: the compose project is named
  // after the docker/ folder, so a worktree or second clone lands here too.
  console.log(
    `  Every checkout of this repo shares ${volume}. If another checkout or worktree uses it,\n` +
      "  copy this docker/.env there too, or its backend will fail to log in to the database.",
  );
  if (compose(["up", "-d", "--wait", "db"]).status !== 0) fail("The db service did not become healthy.");

  const sql = `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \\"$POSTGRES_USER\\" WITH PASSWORD '$POSTGRES_PASSWORD'"`;
  const res = compose(["exec", "-T", "db", "sh", "-c", sql]);
  if (res.status !== 0) {
    fail(
      "Could not reset the database password. The volume was probably created with a different\n" +
        "  POSTGRES_USER or POSTGRES_DB. Either restore the docker/.env it was created with, or wipe\n" +
        "  the local database with `docker compose -f docker/docker-compose.yml down -v` and run this again.",
    );
  }
}

// --- 5. backend jar ---------------------------------------------------------

/** Newest modification time of any file under dir, in ms. */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const time = entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs;
    if (time > newest) newest = time;
  }
  return newest;
}

/** The jar is never rebuilt on its own, so say when it is behind the source. */
function reportStaleJar() {
  const jarTime = statSync(JAR).mtimeMs;
  const sourceTime = Math.max(newestMtime(join(BACKEND, "src")), statSync(join(BACKEND, "pom.xml")).mtimeMs);
  if (sourceTime <= jarTime) return;
  warn(
    "The backend jar is older than the backend source, so the backend will run the old code.\n" +
      "  Rerun with --jar to rebuild it.",
  );
}

/**
 * Build in a throwaway Maven container rather than with backend/mvnw, so the
 * host needs Docker and nothing else: no JDK, no JAVA_HOME. backend/ is
 * mounted, so the jar lands in backend/target exactly where a host build puts
 * it, and compose watch syncs it in from there.
 */
function ensureJar() {
  if (existsSync(JAR) && !REBUILD_JAR) {
    reportStaleJar();
    return;
  }

  step(
    existsSync(JAR)
      ? "Rebuilding the backend jar in a Maven container (tests skipped)…"
      : "No backend jar yet. Building it in a Maven container (tests skipped)…",
  );
  console.log(`  ${MAVEN_IMAGE}; the first build downloads the image and dependencies and is slow.`);

  // The container runs as root. On Linux a bind mount keeps that owner, which
  // would leave backend/target undeletable by you, so hand it back at the end.
  // Docker Desktop (Windows, macOS) maps ownership itself.
  let build = "mvn -q -B -DskipTests package";
  if (process.platform === "linux") {
    const { uid, gid } = userInfo();
    build += ` && chown -R ${uid}:${gid} target`;
  }

  const res = spawnSync(
    "docker",
    ["run", "--rm", "-v", `${BACKEND}:/workspace`, "-v", `${MAVEN_CACHE}:/root/.m2`, "-w", "/workspace", MAVEN_IMAGE, "sh", "-c", build],
    { stdio: "inherit" },
  );
  if (res.status !== 0 || !existsSync(JAR)) fail("The backend build failed; see the Maven output above.");
  console.log(`  Built ${JAR}`);
}

// --- 6. images --------------------------------------------------------------

function ensureImages() {
  const ps = compose(["ps", "-a", "-q"], { capture: true });
  const hasContainers = ps.status === 0 && ps.stdout.trim() !== "";
  if (hasContainers && !REBUILD) return;

  step(REBUILD ? "Rebuilding the images…" : "No containers yet. Building the images…");
  if (compose(["build"]).status !== 0) fail("docker compose build failed; see the output above.");
}

// --- 7. watch, and say when it is ready -------------------------------------

/** True once url answers with any status below 500 within timeoutMs. */
async function answers(url, timeoutMs) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Run compose watch in the foreground and, alongside it, poll the backend's
 * health endpoint and then the frontend. The URLs are printed once both
 * answer, not when the containers merely start: the backend runs Flyway first,
 * and next dev compiles the first page on its first request.
 */
function watch() {
  step("Starting the stack with docker compose watch. Ctrl+C to stop watching.");
  const child = spawn("docker", ["compose", "-f", COMPOSE_FILE, "watch"], { cwd: ROOT, stdio: "inherit" });

  // Ctrl+C reaches compose as well; let it shut down and exit with its code.
  process.on("SIGINT", () => {});

  let exited = false;
  const done = new Promise((resolve) => {
    child.on("exit", (code) => {
      exited = true;
      resolve(code ?? 1);
    });
    child.on("error", (err) => {
      exited = true;
      console.error(err.message);
      resolve(1);
    });
  });

  (async () => {
    const deadline = Date.now() + 10 * 60_000;
    let backendUp = false;
    while (!exited && Date.now() < deadline) {
      await sleep(3_000);
      backendUp ||= await answers(BACKEND_HEALTH, 5_000);
      // Generous timeout: the first request to next dev compiles the page.
      if (backendUp && (await answers(FRONTEND_URL, 60_000))) {
        if (!exited) {
          console.log(
            "\n\u2714 CampusVibe is up.\n" +
              `    Frontend  ${FRONTEND_URL}\n` +
              "    API       http://localhost:8080\n" +
              "  Ctrl+C stops watching. node scripts/dev.mjs --stop or --down stops the containers.\n",
          );
        }
        return;
      }
    }
    if (!exited) warn("The app is still not answering after ten minutes. Check the compose output above.");
  })();

  return done;
}

// --- --stop and --down ------------------------------------------------------

/**
 * stop keeps the containers; down removes them and the network. Neither
 * touches the named data volumes. Only `down -v` would, and that
 * stays a command you type yourself.
 */
function shutDown(mode) {
  if (!dockerIsUp()) {
    step("Docker is not running, so nothing is running.");
    return 0;
  }
  // compose resolves the whole file even to stop it, and the ${VAR:?} guards
  // refuse without docker/.env. The values are unused here, so placeholders do.
  const env = existsSync(ENV_FILE) ? undefined : { POSTGRES_PASSWORD: "unused", JWT_SECRET: "unused" };
  step(
    mode === "stop"
      ? "Stopping the containers. They stay, and node scripts/dev.mjs starts them again…"
      : "Removing the containers and network. The database and uploads are kept…",
  );
  console.log("  Every checkout of this repo shares these containers, so this stops the other checkouts' stack too.");
  return compose([mode], { env }).status ?? 1;
}

// --- main -------------------------------------------------------------------

if (FLAGS.has("--help") || FLAGS.has("-h")) {
  console.log(USAGE);
  process.exit(0);
}

if (FLAGS.has("--env-only")) {
  if (!ensureEnvFile()) reportMissingVars();
  process.exit(0);
}

if (FLAGS.has("--stop")) process.exit(shutDown("stop"));
if (FLAGS.has("--down")) process.exit(shutDown("down"));

await ensureDocker();
const created = ensureEnvFile();
if (!created) reportMissingVars();
await checkPorts();
if (created) syncDbPassword();
ensureJar();
ensureImages();
process.exit(await watch());
