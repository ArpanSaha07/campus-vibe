#!/usr/bin/env node
/**
 * Build the Elastic Beanstalk source bundle.
 *
 * WHY THIS EXISTS
 *
 * An EB source bundle is a zip whose ROOT is the Docker build context — no
 * wrapping folder, no repository. That shape cannot be produced by zipping any
 * directory that exists in this repo: the Dockerfile lives in deploy/eb/ and
 * the jar lives in backend/target/, and EB needs them side by side. Doing it by
 * hand is three steps that are easy to get subtly wrong (a wrapping folder, a
 * stale jar, a zip built with backslash separators), and every one of those
 * fails only after the upload, in the EB console, minutes later.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not deploy. It writes a file and prints its path; uploading is a
 * separate, deliberate act. It also never touches docker/ — local Compose keeps
 * using backend/Dockerfile and is unaffected by anything here.
 *
 * WHY THE JAR IS BUILT HERE AND NOT ON THE INSTANCE
 *
 * See the comment at the top of deploy/eb/Dockerfile. Short version: a Maven
 * build on a 1 GiB t3.micro is slow and OOM-prone, and it would run on the box
 * that has to serve traffic.
 *
 * WHY NODE AND NOT A SHELL SCRIPT
 *
 * Same reason as verify.mjs — this repo is driven from both PowerShell 5.1 and
 * Git Bash, and one Node script behaves identically from either.
 *
 * USAGE
 *
 *   node scripts/package-eb.mjs                # mvnw package -DskipTests, then bundle
 *   node scripts/package-eb.mjs --skip-build   # bundle the jar already in target/
 *   node scripts/package-eb.mjs --tests        # run the tests as part of the build
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKEND = join(REPO, "backend");
const EB_SRC = join(REPO, "deploy", "eb");
const DIST = join(REPO, "dist", "eb");
const STAGE = join(DIST, "bundle");
const WIN = process.platform === "win32";

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);

const step = (msg) => console.log(`\n\x1b[1m==> ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31mpackage-eb: ${msg}\x1b[0m`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// 1. Build the jar
// ---------------------------------------------------------------------------

if (!has("--skip-build")) {
  step(has("--tests") ? "mvnw verify" : "mvnw package -DskipTests");
  const mvnw = WIN ? "mvnw.cmd" : "./mvnw";
  const goals = has("--tests") ? ["-B", "clean", "verify"] : ["-B", "clean", "package", "-DskipTests"];
  const res = spawnSync(mvnw, goals, { cwd: BACKEND, stdio: "inherit", shell: WIN });
  if (res.status !== 0) fail("the Maven build failed; nothing was packaged");
} else {
  step("skipping the build (--skip-build)");
}

// ---------------------------------------------------------------------------
// 2. Locate exactly one jar
//
// Spring Boot's repackage goal leaves campusvibe-<version>.jar.original beside
// the fat jar, and a version bump leaves the previous jar behind unless the
// build was clean. Matching loosely and taking the newest would silently ship a
// stale artifact, so this insists on exactly one candidate instead.
// ---------------------------------------------------------------------------

const target = join(BACKEND, "target");
if (!existsSync(target)) fail(`${target} does not exist — run without --skip-build`);

const jars = readdirSync(target).filter((f) => /^campusvibe-.*\.jar$/.test(f));
if (jars.length === 0) fail("no campusvibe-*.jar in backend/target — run without --skip-build");
if (jars.length > 1) fail(`several jars in backend/target (${jars.join(", ")}) — run a clean build`);

const jar = join(target, jars[0]);
const jarMB = (statSync(jar).size / 1024 / 1024).toFixed(1);
console.log(`    jar: ${jars[0]} (${jarMB} MB)`);

// ---------------------------------------------------------------------------
// 3. Stage the bundle contents
//
// Flat on purpose. Every file sits at the zip root because that is where EB
// looks for the Dockerfile, and because a flat tree sidesteps the separator
// and hidden-file quirks of the Windows zip implementations below.
// ---------------------------------------------------------------------------

step("staging deploy/eb/Dockerfile + app.jar");
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(join(EB_SRC, "Dockerfile"), join(STAGE, "Dockerfile"));
cpSync(jar, join(STAGE, "app.jar"));

// ---------------------------------------------------------------------------
// 4. Zip it
//
// The name carries the commit so an environment's Application Version in the EB
// console maps back to a revision without guesswork.
// ---------------------------------------------------------------------------

const sha = (() => {
  const res = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : "nogit";
})();
const dirty = (() => {
  const res = spawnSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
  return res.status === 0 && res.stdout.trim() !== "" ? "-dirty" : "";
})();
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const zip = join(DIST, `campusvibe-backend-${stamp}-${sha}${dirty}.zip`);

step(`zipping -> ${zip}`);
rmSync(zip, { force: true });

if (WIN) {
  // CreateFromDirectory rather than Compress-Archive: PowerShell 5.1's cmdlet
  // has a long history of writing entry names with backslashes, which the
  // Linux-side unzip on the EB instance reads as one file with a slash in its
  // name. The .NET API writes forward slashes.
  const ps = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${STAGE}', '${zip}')`,
  ].join(" ");
  const res = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    stdio: "inherit",
  });
  if (res.status !== 0) fail("zipping failed");
} else {
  const res = spawnSync("zip", ["-r", "-q", zip, "."], { cwd: STAGE, stdio: "inherit" });
  if (res.status !== 0) fail("zipping failed (is `zip` installed?)");
}

const zipMB = (statSync(zip).size / 1024 / 1024).toFixed(1);

console.log(`
\x1b[32mBundle ready\x1b[0m  ${zip}  (${zipMB} MB)

Contents (zip root):
  Dockerfile
  app.jar

Next: upload it as a new Application Version in the Elastic Beanstalk console,
or  aws elasticbeanstalk create-application-version  followed by
    aws elasticbeanstalk update-environment.
`);
