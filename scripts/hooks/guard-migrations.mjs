#!/usr/bin/env node
/**
 * PreToolUse hook — refuse to write a Flyway migration that cannot ship.
 *
 * WHY THIS EXISTS
 *
 * A migration is immutable the moment it reaches a shared branch. Flyway has
 * run it in every environment that pulled it and recorded its checksum; editing
 * the file afterwards means the checksum no longer matches and Flyway refuses
 * to start. The remedy is always a new migration that supersedes the old one,
 * never an edit — and the V6 saga is what forgetting that cost: two files
 * claiming V12, and a database that would not boot.
 *
 * database-lifecycle/SKILL.md has said so for months, in a file a session only
 * reads if it knows to. rules/db-migrations.md now says it at the moment the
 * file is read. This is the third layer, and the only one that does not depend
 * on anybody having read anything.
 *
 * WHAT IT CHECKS — TWO THINGS, WITH DIFFERENT REMEDIES
 *
 *   1. The exact path already exists on origin/develop or origin/main. That
 *      file has shipped: supersede it, never edit it.
 *
 *   2. The version number is already taken on one of those refs by a
 *      DIFFERENT file. Nothing else catches this early. The two files have
 *      different names, so git merges them without a conflict and the
 *      duplicate only surfaces when both sit in one tree — lint-migrations.mjs
 *      on the next push after a sync, or CI on the pull request, by which
 *      point the migration is written and probably reviewed. The remedy here
 *      is to renumber, not to supersede.
 *
 * Neither check looks at the local branch: a migration written ten minutes ago
 * and not yet pushed is still yours to edit, which is exactly the exception the
 * SKILL grants. Both are only as current as the last `git fetch` — a number
 * claimed on a ref you have not fetched still gets through.
 *
 * KNOWN GAP
 *
 * Only Edit, Write and MultiEdit are covered. `sed -i` through Bash walks past
 * this untouched. Accepted rather than solved — matching every shell command
 * that might write a file is a bigger surface than the problem.
 *
 * BYPASS
 *
 *   CAMPUSVIBE_ALLOW_MIGRATION_EDIT=1
 *
 * Exit 2 is what blocks the tool call and shows stderr to the model; every
 * other path exits 0, because a hook that cannot read its own input must not
 * stop the session.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const MIGRATIONS = "backend/src/main/resources/db/migrations/";
const SHARED_REFS = ["origin/develop", "origin/main"];
const VERSIONED = /^V(\d+)__.+\.sql$/;

const allow = () => process.exit(0);

function git(args) {
  const res = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

// Flyway normalises a numeric version, so V06 and V6 are the same migration.
// Compare the number, never the string.
const versionOf = (name) => {
  const match = name.match(VERSIONED);
  return match ? Number(match[1]) : null;
};

if (process.env.CAMPUSVIBE_ALLOW_MIGRATION_EDIT === "1") allow();

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  allow();
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath.length === 0) allow();

const rel = relative(REPO, resolve(REPO, filePath)).split(sep).join("/");
if (!rel.startsWith(MIGRATIONS)) allow();

const name = rel.slice(MIGRATIONS.length);
const version = versionOf(name);
if (version === null) allow();

// What each shared ref holds, by basename. A ref that has never been fetched,
// or has no migrations directory, simply contributes nothing.
const shared = new Map();
for (const ref of SHARED_REFS) {
  const listing = git(["ls-tree", "--name-only", `${ref}:${MIGRATIONS.slice(0, -1)}`]);
  if (listing) shared.set(ref, listing.split("\n").filter(Boolean));
}

const shipped = [...shared]
  .filter(([, files]) => files.includes(name))
  .map(([ref]) => ref);

const clashes = [];
for (const [ref, files] of shared) {
  for (const file of files) {
    if (file !== name && versionOf(file) === version) clashes.push({ ref, file });
  }
}

if (shipped.length === 0 && clashes.length === 0) allow();

// The next free number has to clear every ref as well as this tree, or the
// suggestion walks straight into the collision this hook just refused.
let next = "<n+1>";
try {
  const local = readdirSync(join(REPO, MIGRATIONS));
  const taken = [local, ...shared.values()]
    .flat()
    .map(versionOf)
    .filter((n) => n !== null);
  if (taken.length > 0) next = `V${Math.max(...taken) + 1}`;
} catch {
  // Leave the placeholder. The refusal is the point; the suggestion is a bonus.
}

const lines = [];

if (shipped.length > 0) {
  lines.push(
    `Refused: ${name} already exists on ${shipped.join(" and ")}.`,
    "",
    "A shared migration is immutable. Flyway has run it wherever this branch",
    "was pulled and recorded its checksum, so editing the file makes the",
    "checksum disagree and Flyway refuses to start.",
    "",
    `Supersede it with a new migration: ${MIGRATIONS}${next}__<intent>.sql`,
  );
} else {
  const where = clashes.map((c) => `${c.file} on ${c.ref}`).join(", ");
  lines.push(
    `Refused: version V${version} is already taken by ${where}.`,
    "",
    `${name} is a different filename, so git will merge both without a`,
    "conflict and Flyway will then refuse to start on the duplicate version.",
    "Nothing catches that until the two files sit in one tree - the migration",
    "lint on your next push after syncing, or CI on the pull request.",
    "",
    `Renumber this migration, keeping its intent: ${MIGRATIONS}${next}__<intent>.sql`,
  );
}

lines.push(
  "",
  "See .claude/rules/db-migrations.md and skills/database-lifecycle/SKILL.md.",
  "These refs are only as current as your last fetch. If this file is",
  "genuinely local-only, ask Arpan before overriding -",
  "CAMPUSVIBE_ALLOW_MIGRATION_EDIT=1 bypasses this hook.",
);

console.error(lines.join("\n"));

process.exit(2);
