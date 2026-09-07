#!/usr/bin/env node
/**
 * PreToolUse hook — refuse to edit a Flyway migration that has already shipped.
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
 * WHAT IT CHECKS
 *
 * The tool's target path is a V<n>__*.sql under db/migrations, and the same
 * path exists on origin/develop or origin/main. Not on the local branch: a
 * migration you wrote ten minutes ago and have not pushed is still yours to
 * edit, which is exactly the exception the SKILL grants.
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

const allow = () => process.exit(0);

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
if (!/^V\d+__.+\.sql$/.test(rel.slice(MIGRATIONS.length))) allow();

const shared = SHARED_REFS.filter(
  (ref) =>
    spawnSync("git", ["cat-file", "-e", `${ref}:${rel}`], { cwd: REPO }).status === 0,
);
if (shared.length === 0) allow();

let next = "<n+1>";
try {
  const numbers = readdirSync(join(REPO, MIGRATIONS))
    .map((name) => name.match(/^V(\d+)__/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  if (numbers.length > 0) next = `V${Math.max(...numbers) + 1}`;
} catch {
  // Leave the placeholder. The refusal is the point; the suggestion is a bonus.
}

console.error(
  [
    `Refused: ${rel} already exists on ${shared.join(" and ")}.`,
    "",
    "A shared migration is immutable. Flyway has run it wherever this branch",
    "was pulled and recorded its checksum, so editing the file makes the",
    "checksum disagree and Flyway refuses to start.",
    "",
    `Supersede it instead: ${MIGRATIONS}${next}__<intent>.sql`,
    "",
    "See .claude/rules/db-migrations.md and skills/database-lifecycle/SKILL.md.",
    "If this file is genuinely local-only and the shared copy is a different",
    "change, ask Arpan before overriding - CAMPUSVIBE_ALLOW_MIGRATION_EDIT=1",
    "bypasses this hook.",
  ].join("\n"),
);

process.exit(2);
