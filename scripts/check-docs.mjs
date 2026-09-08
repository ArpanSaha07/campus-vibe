#!/usr/bin/env node
/**
 * Report architecture docs that look out of date. Never blocks by default.
 *
 * WHY THIS EXISTS
 *
 * Tests do not drift, because something fails. Docs drift because updating them
 * is a separate act of will performed after the work already feels finished —
 * three of the twelve docs in .claude/docs/architecture/ are stamped `never`
 * because they were never reconciled with the code at all, which is what that
 * looks like after a few months.
 *
 * So this makes staleness *visible at the same boundary where tests are
 * checked*, without pretending a stale doc is a broken build.
 *
 * WHY IT IS ADVISORY AND EXITS 0
 *
 * A blocking doc check teaches you to reach for `git push --no-verify`, and
 * that flag also skips the tests. Trading a real gate for a paper one is a bad
 * trade. This prints and gets out of the way. `--strict` exists for a CI step
 * that wants a real exit code; the hooks never pass it.
 *
 * THREE SIGNALS
 *
 *   1. Diff-based — you changed code an area's doc, skill or rule describes,
 *      and did not touch it in the same range. Catches the common case
 *      immediately.
 *   2. Stamp-based — a doc's `Code as of:` sha is N commits behind HEAD.
 *      Catches slow drift, where each individual change felt too small to
 *      document.
 *   3. Status — `.claude/STATUS.md` carries the same stamp, and a session
 *      orients from it, so it being far behind HEAD matters more than any one
 *      doc being behind.
 *
 * WHAT A STAMP MUST LOOK LIKE
 *
 *   **Code as of:** d4afe79
 *   **Code as of:** `d4afe79` *(plus anything you like after the sha)*
 *   **Code as of:** never — not reconciled with the code
 *
 * Anything else — prose such as `the uncommitted working tree`, a date, a
 * branch name — is reported as unparseable, even under --quiet, because a
 * stamp that cannot be checked is a defect in the doc rather than drift in the
 * code. For three weeks every mapped doc had one of those, and this check
 * silently reported nothing. A doc with no stamp at all is reported as
 * unstamped rather than assumed current.
 *
 * USAGE
 *
 *   node scripts/check-docs.mjs                 # against origin/main
 *   node scripts/check-docs.mjs --base <sha>    # against a specific commit
 *   node scripts/check-docs.mjs --staged        # against the index (pre-commit)
 *   node scripts/check-docs.mjs --quiet         # print only when something is stale
 *   node scripts/check-docs.mjs --strict        # exit 1 on unparseable or missing stamps
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const CLAUDE_DIR = join(REPO, ".claude");
const DOCS_DIR = join(CLAUDE_DIR, "docs", "architecture");
const RULES_DIR = join(CLAUDE_DIR, "rules");
const STATUS_PATH = join(CLAUDE_DIR, "STATUS.md");
const MAP_PATH = join(REPO, "scripts", "docs-map.json");

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const strict = argv.includes("--strict");
const staged = argv.includes("--staged");
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

let changed = [];
let rangeLabel;

if (staged) {
  // The index, for the pre-commit hook: what is about to be committed.
  changed = (git(["diff", "--cached", "--name-only"]) ?? "").split("\n").filter(Boolean);
  rangeLabel = "the index";
} else {
  const range = git(["rev-parse", "--verify", base]) ? `${base}...HEAD` : null;
  changed = range ? (git(["diff", "--name-only", range]) ?? "").split("\n").filter(Boolean) : [];
  rangeLabel = range;
  if (range === null && !quiet) {
    console.log(`docs: no usable base (${base}); skipping the diff check.`);
  }
}

const touched = (relPath) => changed.some((f) => f.endsWith(relPath));

const findings = [];

for (const [docFile, entry] of Object.entries(map.docs)) {
  const hits = changed.filter((f) => entry.paths.some((p) => f.startsWith(p)));
  if (hits.length > 0 && !touched(`.claude/docs/architecture/${docFile}`)) {
    findings.push({ kind: "diff", doc: docFile, hits, covers: entry.covers });
  }
}

for (const [name, entry] of Object.entries(map.skills ?? {})) {
  const hits = changed.filter((f) => entry.paths.some((p) => f.startsWith(p)));
  if (hits.length > 0) {
    findings.push({ kind: "skill", doc: name, hits, covers: entry.reason, path: entry.path });
  }
}

// Rules are small and path-scoped, so the only way they rot is code moving
// out from under them. Same signal as a doc: the code changed, the rule did not.
for (const [ruleFile, entry] of Object.entries(map.rules ?? {})) {
  const hits = changed.filter((f) => entry.paths.some((p) => f.startsWith(p)));
  if (hits.length > 0 && !touched(`.claude/rules/${ruleFile}`)) {
    findings.push({ kind: "rule", doc: ruleFile, hits, covers: entry.reason });
  }
}

// ---------------------------------------------------------------------------
// How far behind each stamp is
// ---------------------------------------------------------------------------

// The whole rest of the line, so prose after a bare sha is tolerated and prose
// instead of a sha is caught.
const STAMP_LINE = /^\*\*Code as of:\*\*[ \t]*(.*)$/m;
const SHA = /^`?([0-9a-f]{7,40})`?(?![0-9a-z])/i;

/** Returns { kind: "never" | "sha" | "unparseable" | "unstamped", sha?, raw? }. */
function readStamp(fullPath) {
  // Only the head of the file is scanned: the stamp belongs in the status block.
  const head = readFileSync(fullPath, "utf8").slice(0, 2000);
  const m = head.match(STAMP_LINE);
  if (!m) return { kind: "unstamped" };
  const raw = m[1].trim();
  if (/^never\b/i.test(raw)) return { kind: "never" };
  const s = raw.match(SHA);
  if (!s) return { kind: "unparseable", raw };
  const sha = s[1];
  // A sha that git does not know is as useless as prose.
  if (spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: REPO }).status !== 0) {
    return { kind: "unparseable", raw: `${raw} (not a commit in this repository)` };
  }
  return { kind: "sha", sha };
}

/** One line of context for a stamp that cannot be checked. */
function lastTouched(paths) {
  return git(["log", "-1", "--format=%h %ad", "--date=short", "--", ...paths]) || "never committed";
}

for (const [docFile, entry] of Object.entries(map.docs)) {
  const full = join(DOCS_DIR, docFile);
  if (!existsSync(full)) {
    findings.push({ kind: "missing", doc: docFile });
    continue;
  }
  const stamp = readStamp(full);
  if (stamp.kind === "never") continue; // honestly labelled already
  if (stamp.kind === "sha") {
    const behind = git(["rev-list", "--count", `${stamp.sha}..HEAD`]);
    if (behind && Number(behind) > 0) {
      findings.push({ kind: "behind", doc: docFile, behind: Number(behind), sha: stamp.sha });
    }
    continue;
  }
  findings.push({
    kind: stamp.kind, // unstamped | unparseable
    doc: docFile,
    raw: stamp.raw,
    docEdited: lastTouched([`.claude/docs/architecture/${docFile}`]),
    areaChanged: lastTouched(entry.paths),
  });
}

// STATUS.md is what a session orients from, so its drift is reported on its
// own — loudly in full mode, and even under --quiet once it is well behind.
const STATUS_QUIET_THRESHOLD = 5;
if (existsSync(STATUS_PATH)) {
  const stamp = readStamp(STATUS_PATH);
  if (stamp.kind === "sha") {
    const behind = Number(git(["rev-list", "--count", `${stamp.sha}..HEAD`]) ?? 0);
    if (behind > 0) findings.push({ kind: "status", behind, sha: stamp.sha });
  } else if (stamp.kind !== "never") {
    findings.push({ kind: "status-unparseable", raw: stamp.raw ?? "(no stamp)" });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const loud = (f) =>
  f.kind === "diff" ||
  f.kind === "skill" ||
  f.kind === "rule" ||
  f.kind === "unparseable" ||
  f.kind === "status-unparseable" ||
  f.kind === "missing" ||
  (f.kind === "status" && f.behind > STATUS_QUIET_THRESHOLD);

const defects = findings.filter((f) =>
  f.kind === "unparseable" || f.kind === "unstamped" || f.kind === "missing" || f.kind === "status-unparseable",
);

if (findings.length === 0) {
  if (!quiet) console.log("docs: nothing looks stale.");
  process.exit(0);
}

if (quiet && !findings.some(loud)) process.exit(0);

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
  } else if (f.kind === "rule") {
    console.log(`docs: ${f.hits.length} file(s) changed that .claude/rules/${f.doc} governs,`);
    console.log(`      but the rule was not updated. Re-read it: if a trap moved, move the line.`);
    console.log(`      ${f.covers}`);
    for (const h of f.hits.slice(0, 4)) console.log(`        ${h}`);
    if (f.hits.length > 4) console.log(`        … and ${f.hits.length - 4} more`);
    console.log("");
  }
}

const behind = findings.filter((f) => f.kind === "behind");
const unstamped = findings.filter((f) => f.kind === "unstamped");
const unparseable = findings.filter((f) => f.kind === "unparseable");
const missing = findings.filter((f) => f.kind === "missing");
const status = findings.find((f) => f.kind === "status");
const statusBad = findings.find((f) => f.kind === "status-unparseable");

if (!quiet && behind.length > 0) {
  console.log("docs: verified against an older commit —");
  for (const f of behind) console.log(`      ${f.doc}: ${f.behind} commit(s) behind (${f.sha})`);
  console.log("");
}
if (unparseable.length > 0) {
  console.log("docs: 'Code as of:' is not a commit sha, so drift cannot be measured —");
  for (const f of unparseable) {
    console.log(`      ${f.doc}: reads '${f.raw.slice(0, 60)}'`);
    console.log(`        doc last edited ${f.docEdited}; its area last changed ${f.areaChanged}`);
  }
  console.log("      Re-read the doc against the code and stamp it with the short sha of HEAD.");
  console.log("");
}
if (!quiet && unstamped.length > 0) {
  console.log("docs: no 'Code as of:' stamp —");
  for (const f of unstamped) {
    console.log(`      ${f.doc}: doc last edited ${f.docEdited}; its area last changed ${f.areaChanged}`);
  }
  console.log("");
}
if (missing.length > 0) {
  console.log(`docs: mapped in docs-map.json but not on disk — ${missing.map((f) => f.doc).join(", ")}`);
  console.log("");
}
if (status && (!quiet || status.behind > STATUS_QUIET_THRESHOLD)) {
  console.log(`docs: .claude/STATUS.md was written ${status.behind} commit(s) ago (${status.sha}).`);
  console.log("      A session orients from it; /wrap-up refreshes it.");
  console.log("");
}
if (statusBad) {
  console.log(`docs: .claude/STATUS.md has no parseable 'Code as of:' stamp (reads '${statusBad.raw.slice(0, 60)}').`);
  console.log("");
}

if (strict && defects.length > 0) {
  console.log(`docs: --strict — ${defects.length} defect(s) above; exiting 1.`);
  console.log("");
  process.exit(1);
}

console.log("Advisory only — nothing here blocks a push.");
console.log("Update the doc per .claude/skills/implementation-docs/SKILL.md, or");
console.log("if the change genuinely does not affect it, just re-stamp it.");
console.log("");

process.exit(0);
