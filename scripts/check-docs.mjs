#!/usr/bin/env node
/**
 * Report architecture docs that look out of date. Never blocks.
 *
 * WHY THIS EXISTS
 *
 * Tests do not drift, because something fails. Docs drift because updating them
 * is a separate act of will performed after the work already feels finished —
 * and four of the seven docs in .claude/docs/architecture/ currently carry an
 * `unverified` banner, which is what that looks like after a few months.
 *
 * So this makes staleness *visible at the same boundary where tests are
 * checked*, without pretending a stale doc is a broken build.
 *
 * WHY IT IS ADVISORY AND ALWAYS EXITS 0
 *
 * A blocking doc check teaches you to reach for `git push --no-verify`, and
 * that flag also skips the tests. Trading a real gate for a paper one is a bad
 * trade. This prints and gets out of the way.
 *
 * TWO SIGNALS
 *
 *   1. Diff-based — you changed code an area's doc describes, and did not touch
 *      the doc in the same range. Catches the common case immediately.
 *   2. Stamp-based — a doc's `Code as of:` sha is N commits behind HEAD.
 *      Catches slow drift, where each individual change felt too small to
 *      document.
 *
 * A doc with no stamp is reported as unstamped rather than assumed current.
 * A doc whose stamp reads `never` (the honest value for the ones that predate
 * the standard) is left alone — it is already labelled in its own banner, and
 * repeating that on every push is noise.
 *
 * USAGE
 *
 *   node scripts/check-docs.mjs                 # against origin/main
 *   node scripts/check-docs.mjs --base <sha>    # against a specific commit
 *   node scripts/check-docs.mjs --quiet         # print only when something is stale
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS_DIR = join(REPO, ".claude", "docs", "architecture");
const MAP_PATH = join(REPO, "scripts", "docs-map.json");

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const baseArg = argv[argv.indexOf("--base") + 1];
const base = argv.includes("--base") && baseArg ? baseArg : "origin/main";

function git(args) {
  const res = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

const range = git(["rev-parse", "--verify", base]) ? `${base}...HEAD` : null;
const changed = range ? (git(["diff", "--name-only", range]) ?? "").split("\n").filter(Boolean) : [];

if (range === null && !quiet) {
  console.log(`docs: no usable base (${base}); skipping the diff check.`);
}

const touchedDoc = (docFile) =>
  changed.some((f) => f.endsWith(`.claude/docs/architecture/${docFile}`));

const findings = [];

for (const [docFile, entry] of Object.entries(map.docs)) {
  const hits = changed.filter((f) => entry.paths.some((p) => f.startsWith(p)));
  if (hits.length > 0 && !touchedDoc(docFile)) {
    findings.push({ kind: "diff", doc: docFile, hits, covers: entry.covers });
  }
}

for (const [name, entry] of Object.entries(map.skills ?? {})) {
  const hits = changed.filter((f) => entry.paths.some((p) => f.startsWith(p)));
  if (hits.length > 0) {
    findings.push({ kind: "skill", doc: name, hits, covers: entry.reason, path: entry.path });
  }
}

// ---------------------------------------------------------------------------
// How far behind each doc's stamp is
// ---------------------------------------------------------------------------

const STAMP = /^\*\*Code as of:\*\*\s*(\S+)/m;

for (const docFile of Object.keys(map.docs)) {
  const full = join(DOCS_DIR, docFile);
  if (!existsSync(full)) {
    findings.push({ kind: "missing", doc: docFile });
    continue;
  }

  // Only the head of the file is scanned: the stamp belongs in the status block.
  const head = readFileSync(full, "utf8").slice(0, 2000);
  const m = head.match(STAMP);

  if (!m) {
    findings.push({ kind: "unstamped", doc: docFile });
    continue;
  }
  if (/^never/i.test(m[1])) continue; // honestly labelled already

  const behind = git(["rev-list", "--count", `${m[1]}..HEAD`]);
  if (behind && Number(behind) > 0) {
    findings.push({ kind: "behind", doc: docFile, behind: Number(behind), sha: m[1] });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const stale = findings.filter((f) => f.kind === "diff" || f.kind === "skill");

if (findings.length === 0) {
  if (!quiet) console.log("docs: nothing looks stale.");
  process.exit(0);
}

if (quiet && stale.length === 0) process.exit(0);

console.log("");
for (const f of findings) {
  if (f.kind === "diff") {
    console.log(`docs: ${f.hits.length} file(s) changed under an area ${f.doc} describes,`);
    console.log(`      but ${f.doc} was not updated.`);
    console.log(`      it covers: ${f.covers}`);
    for (const h of f.hits.slice(0, 4)) console.log(`        ${h}`);
    if (f.hits.length > 4) console.log(`        … and ${f.hits.length - 4} more`);
    console.log("");
  } else if (f.kind === "skill") {
    console.log(`docs: ${f.hits.length} file(s) changed that the ${f.doc} skill governs.`);
    console.log(`      ${f.covers}`);
    console.log(`      ${f.path}`);
    console.log("");
  }
}

const behind = findings.filter((f) => f.kind === "behind");
const unstamped = findings.filter((f) => f.kind === "unstamped");

if (!quiet && behind.length > 0) {
  console.log("docs: verified against an older commit —");
  for (const f of behind) console.log(`      ${f.doc}: ${f.behind} commit(s) behind (${f.sha})`);
  console.log("");
}
if (!quiet && unstamped.length > 0) {
  console.log(`docs: no 'Code as of:' stamp — ${unstamped.map((f) => f.doc).join(", ")}`);
  console.log("");
}

console.log("Advisory only — nothing here blocks a push.");
console.log("Update the doc per .claude/skills/implementation-docs/SKILL.md, or");
console.log("if the change genuinely does not affect it, just re-stamp it.");
console.log("");

process.exit(0);
