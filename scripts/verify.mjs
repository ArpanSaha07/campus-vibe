#!/usr/bin/env node
/**
 * Run the checks CI runs, locally, before the push.
 *
 * WHY THIS EXISTS
 *
 * Two consecutive pushes broke the Frontend job for two different reasons:
 *
 *   1. The checks were never run at all (BUG-026 — a type error).
 *   2. The checks were run, and passed, in an environment CI does not have
 *      (BUG-027 — `/clubs` prerendered at build time and needed a backend;
 *      the dev machine had one running on :8080, a CI runner does not).
 *
 * The second is the interesting one. A build verified on a machine where the
 * API happens to be up does not test what CI tests. So this script does not
 * just run the same commands — it runs them against the same *environment*,
 * which for the frontend build means a backend that cannot be reached.
 *
 * WHAT IT MIRRORS
 *
 * .github/workflows/_frontend.yml: lint, type-check, test, build — in that
 * order, each running even when an earlier one failed (`if: '!cancelled()'`),
 * so one run reports every problem instead of one problem per run.
 *
 * .github/workflows/_backend.yml: ./mvnw -B verify.
 *
 * WHAT IT RUNS THAT CI DOES NOT
 *
 * The hook guards (scripts/hooks/*.test.mjs), and deliberately. A PreToolUse
 * hook guards a session on a developer's machine; there is no session on a
 * runner, so there is nothing there for a CI job to assert against. This is the
 * one step where local is not mirroring CI but covering a place CI cannot go —
 * so a red hook guard here is NOT a prediction that the pull request will fail.
 *
 * Two workflows mirror this split. branch-checks.yml runs the same scoped, fast
 * checks on a push; ci.yml runs everything on a pull request to main. This
 * script is what catches the failure BEFORE the push, which is still the only
 * place it costs nothing. By default it skips the integration suites — the same
 * trade branch-checks.yml makes — so pass --full to run them before opening a PR.
 *
 * WHY NODE AND NOT A SHELL SCRIPT
 *
 * This repo is driven from both PowerShell 5.1 and Git Bash. PowerShell 5.1 has
 * no `&&`, no `export VAR=x cmd` prefix, and needs `npm.cmd`/`mvnw.cmd` rather
 * than `npm`/`mvnw`. One Node script behaves identically from either.
 *
 * USAGE
 *
 *   node scripts/verify.mjs                 # detect changed components vs origin/main
 *   node scripts/verify.mjs --frontend      # frontend only
 *   node scripts/verify.mjs --backend       # backend only
 *   node scripts/verify.mjs --hooks         # the PreToolUse hook guards only
 *   node scripts/verify.mjs --all           # everything
 *   node scripts/verify.mjs --full          # backend integration suites too
 *   node scripts/verify.mjs --base <ref>    # detect changes against <ref>
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const FRONTEND = join(REPO, "frontend");
const BACKEND = join(REPO, "backend");
const WIN = process.platform === "win32";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};

const full = has("--full");

// ---------------------------------------------------------------------------
// Which components changed
//
// Mirrors the `dorny/paths-filter` block in branch-checks.yml — not ci.yml,
// which deliberately filters coarsely because it gates merges. Both of its
// choices are copied here: a change under .github/workflows/ runs everything
// (the pipeline cannot be trusted to scope itself), and an unknown base fails
// OPEN rather than silently skipping every component.
// ---------------------------------------------------------------------------

const ZERO_SHA = "0".repeat(40);

function changedFiles(base) {
  if (!base || base === ZERO_SHA) return null; // unknown base -> fail open
  const res = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (res.status !== 0) return null;
  return res.stdout.split("\n").filter(Boolean);
}

// A hook and the rule it enforces are one unit: guard-aws.mjs is only correct
// with respect to what aws-handling.md claims, and settings.json is what
// registers it at all. Change any of the three and the hook guards run.
const HOOK_PATHS = [
  "scripts/hooks/",
  ".claude/rules/aws-handling.md",
  ".claude/rules/db-migrations.md",
  ".claude/settings.json",
];

function selectComponents() {
  if (has("--all")) return { frontend: true, backend: true, hooks: true, why: "--all" };
  if (has("--frontend") && has("--backend")) {
    return { frontend: true, backend: true, hooks: false, why: "--frontend --backend" };
  }
  if (has("--frontend")) return { frontend: true, backend: false, hooks: false, why: "--frontend" };
  if (has("--backend")) return { frontend: false, backend: true, hooks: false, why: "--backend" };
  if (has("--hooks")) return { frontend: false, backend: false, hooks: true, why: "--hooks" };

  const base = valueOf("--base") ?? "origin/main";
  const files = changedFiles(base);

  if (files === null) {
    return {
      frontend: true,
      backend: true,
      hooks: true,
      why: `no usable base (${base}); running everything`,
    };
  }
  if (files.some((f) => f.startsWith(".github/workflows/"))) {
    return { frontend: true, backend: true, hooks: true, why: "workflows changed" };
  }
  return {
    frontend: files.some((f) => f.startsWith("frontend/")),
    backend: files.some((f) => f.startsWith("backend/")),
    hooks: files.some((f) => HOOK_PATHS.some((p) => f.startsWith(p))),
    why: `${files.length} file(s) changed vs ${base}`,
  };
}

// ---------------------------------------------------------------------------
// A port with nothing behind it
//
// The whole point of the build step below. Binding a port proves nothing is
// listening on it; once released, a connection to it is refused — which is
// what a Server Component fetching at build time meets on a CI runner.
//
// Hardcoding a port would be a silent failure if something happened to be
// bound to it: the build would fetch *something* and pass.
// ---------------------------------------------------------------------------

async function findClosedPort(start = 59999) {
  for (let port = start; port > start - 50; port--) {
    const free = await new Promise((resolve) => {
      const srv = createServer();
      srv.once("error", () => resolve(false));
      srv.once("listening", () => srv.close(() => resolve(true)));
      srv.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error("could not find a closed port to point the build at");
}

// ---------------------------------------------------------------------------
// Running steps
// ---------------------------------------------------------------------------

const results = [];

/** Quote a token only when it needs it, so the command stays readable in logs. */
function quoteForShell(token) {
  return /[\s&|<>^]/.test(token) ? `"${token}"` : token;
}

function run(name, cmd, args, { cwd, env } = {}) {
  process.stdout.write(`\n\u2500\u2500 ${name} ${"\u2500".repeat(Math.max(0, 60 - name.length))}\n`);
  const started = Date.now();

  // Windows needs a shell because npm and mvnw are .cmd wrappers and Node
  // refuses to spawn a .cmd directly. Without it every step fails instantly
  // with EINVAL and no output — which looks exactly like a real failure, and
  // is the sort of thing this script exists to stop.
  //
  // The command is passed as one pre-quoted string rather than as an args
  // array: an array combined with `shell: true` is concatenated unescaped
  // (Node DEP0190). Everything here is a hardcoded literal, so nothing is
  // injectable either way, but quoting once is what makes a path like
  // C:/Program Files/... work at all.
  const opts = { cwd, stdio: "inherit", env: { ...process.env, ...env } };
  const res = WIN
    ? spawnSync([cmd, ...args].map(quoteForShell).join(" "), { ...opts, shell: true })
    : spawnSync(cmd, args, { ...opts, shell: false });

  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  // A step that could not be launched is not a step that failed a check.
  // Report the distinction — a missing toolchain and a real lint error need
  // different responses.
  if (res.error) {
    console.error(`\n  could not run ${name}: ${res.error.message}`);
    results.push({ name, ok: false, seconds, note: `could not run: ${res.error.code ?? ""}` });
    return false;
  }

  const ok = res.status === 0;
  results.push({ name, ok, seconds });
  return ok;
}

const npm = WIN ? "npm.cmd" : "npm";

// ---------------------------------------------------------------------------
// Frontend
// ---------------------------------------------------------------------------

async function verifyFrontend() {
  run("lint", npm, ["run", "lint"], { cwd: FRONTEND });
  run("type-check", npm, ["run", "type-check"], { cwd: FRONTEND });
  run("test", npm, ["test", "--", "--ci"], { cwd: FRONTEND });

  // A stale Turbopack cache once served pre-edit CSS for a whole session
  // (BUG-021). A verification step that trusts that cache can reproduce it, so
  // start from nothing — CI always does, it checks out fresh.
  //
  // Safe with the dev container running: docker-compose's develop.watch sync
  // lists .next/ under `ignore`, so the container keeps its own.
  //
  // Not fatal if it fails. On Windows a running preview server (`npm start`)
  // keeps a handle on .next and the delete returns EPERM; that is a dirty
  // cache, not a broken build, so warn and let the build run rather than
  // aborting the whole verification over it.
  const next = join(FRONTEND, ".next");
  if (existsSync(next)) {
    try {
      rmSync(next, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (err) {
      console.warn(
        `\n  warning: could not clear .next (${err.code ?? err.message}).\n` +
          `  A preview or dev server is probably holding it. Building against the\n` +
          `  existing cache, which CI would not have. Stop it and re-run if the\n` +
          `  build result looks wrong.\n`,
      );
    }
  }

  const deadPort = await findClosedPort();

  run("build", npm, ["run", "build"], {
    cwd: FRONTEND,
    env: {
      // The reason this script exists. Nothing is listening here, so any route
      // that fetches during `next build` fails exactly as it does on a runner
      // with no backend, instead of quietly succeeding against the dev stack.
      API_INTERNAL_URL: `http://127.0.0.1:${deadPort}`,
      // Set as _frontend.yml sets them, so the build is deterministic.
      NEXT_PUBLIC_API_URL: "http://localhost:8080",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
    },
  });
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

/**
 * There is no JDK on PATH on this machine and JAVA_HOME is unset; the only
 * installed JDK is IntelliJ's bundled JBR, which matches the pom's Java 25.
 * Resolving it here means the hook works without the shell being prepared.
 */
function resolveJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:/Program Files/JetBrains/IntelliJ IDEA 2026.2/jbr",
    "C:/Program Files/JetBrains/IntelliJ IDEA 2026.1/jbr",
    "C:/Program Files/JetBrains/IntelliJ IDEA Community Edition/jbr",
  ];
  return candidates.find((p) => existsSync(p));
}

function verifyBackend() {
  // Before the JDK check on purpose, so a machine without a JDK still gets the
  // migration lint. It needs no Java, takes milliseconds, and guards the one
  // artifact that is expensive to amend: a migration is immutable once applied,
  // so a mistake caught here costs an edit and a mistake caught on GitHub costs
  // a new migration. This is the same script the Database workflow runs.
  const migrationsOk = run(
    "migration lint",
    "node",
    [join(REPO, "scripts", "lint-migrations.mjs")],
    { cwd: REPO },
  );

  // Gate the build on it, the way _database.yml makes `migrate` need
  // `lint-migrations`. Unlike the other steps here this one is never worth
  // reporting alongside a build: it is always a hard blocker and always a
  // one-line fix, so spending two minutes of Maven to tell the developer
  // something they already have to fix is pure waiting.
  if (!migrationsOk) {
    console.error("\nSkipping the backend build - fix the migration first.");
    return;
  }

  const javaHome = resolveJavaHome();
  if (!javaHome) {
    results.push({
      name: "backend",
      ok: false,
      seconds: "0.0",
      note: "no JDK found - set JAVA_HOME",
    });
    console.error(
      "\nNo JDK found. Set JAVA_HOME to a Java 25 JDK, e.g.\n" +
        `  JAVA_HOME="C:/Program Files/JetBrains/IntelliJ IDEA 2026.2/jbr"\n`,
    );
    return;
  }

  const mvnw = WIN ? join(BACKEND, "mvnw.cmd") : join(BACKEND, "mvnw");
  const args = full ? ["-B", "verify"] : ["-B", "verify", "-DskipITs"];

  // Never pipe this into tail/grep to read the result: the pipeline's exit code
  // is the last command's, so a failed build reports success. stdio: inherit
  // keeps the output visible and `res.status` authoritative.
  run(full ? "backend (full)" : "backend (fast)", mvnw, args, {
    cwd: BACKEND,
    env: { JAVA_HOME: javaHome },
  });
}

// ---------------------------------------------------------------------------
// Hook guards
//
// The odd one out: no CI job mirrors this, because a PreToolUse hook only ever
// runs on a developer's machine — there is no session on a runner for it to
// guard. Running it here is not parity with CI, it is the only place the check
// can happen at all.
//
// Worth the two hundred milliseconds because the failure is silent. A hook that
// stops refusing does not error; the session simply proceeds, and the first
// sign is an AWS operation that should have been blocked.
// ---------------------------------------------------------------------------

function verifyHooks() {
  run("hook guards", "node", [join(REPO, "scripts", "hooks", "guard-aws.test.mjs")], { cwd: REPO });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const picked = selectComponents();

console.log("CampusVibe local CI parity");
console.log(`  components: ${picked.why}`);
console.log(
  `  running:    ${[picked.frontend && "frontend", picked.backend && "backend", picked.hooks && "hooks"]
    .filter(Boolean)
    .join(" + ") || "nothing"}`,
);

if (!picked.frontend && !picked.backend && !picked.hooks) {
  console.log("\nNothing to verify.");
  process.exit(0);
}

// First: milliseconds, no toolchain, and it decides nothing else — the same
// argument the migration lint makes for running ahead of the backend build.
if (picked.hooks) verifyHooks();
if (picked.frontend) await verifyFrontend();
if (picked.backend) verifyBackend();

console.log(`\n${"\u2550".repeat(64)}\nSummary\n`);
const width = Math.max(12, ...results.map((r) => r.name.length + 2));
for (const r of results) {
  const status = r.ok ? "pass" : "FAIL";
  console.log(
    `  ${r.name.padEnd(width, ".")} ${status.padEnd(5)} ${r.seconds.padStart(6)}s` +
      (r.note ? `  ${r.note}` : ""),
  );
}

// The hook guards are the one step with no CI counterpart, so neither closing
// line may claim CI would have said the same about them.
const localOnly = picked.hooks ? "\n(The hook guards are local-only - CI has no session to guard.)" : "";

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.log(`\n${failed.length} step(s) failed: ${failed.map((r) => r.name).join(", ")}`);
  console.log(`This is what CI would have reported.${localOnly}\n`);
  process.exit(1);
}

console.log(`\nAll checks passed - this is what CI will run.${localOnly}\n`);
