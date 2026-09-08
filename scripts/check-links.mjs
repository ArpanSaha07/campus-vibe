#!/usr/bin/env node
/**
 * Dead-link check for the knowledge base under .claude/.
 *
 * WHY THIS EXISTS
 *
 * The files in .claude/ point at each other constantly — a todo item at the bug
 * it fixes, a bug at the doc that explains the subsystem, a doc at the decision
 * behind it. Those links are how a session gets from the one file it was told
 * to read to the one it actually needs. Nothing checked them, and by 2026-09-06
 * `todo.md` listed two bugs as an open P0 through anchors into `bugs.md` that
 * had moved to `fixed_bugs.md` three weeks earlier. A dead link is worse than
 * no link: it says the thing exists and then hides it.
 *
 * WHAT IT CHECKS
 *
 *   - every `[text](target)` in every .md under .claude/ whose target is a
 *     relative path: the file (or directory) must exist
 *   - a `#fragment` on a markdown target, or on its own, must match a heading
 *     in that file, slugged the way GitHub does it
 *
 * Skipped: http(s) and mailto links, targets inside fenced code blocks or
 * inline code (SKILL.md templates show link syntax as examples), and
 * `.claude/docs/commit-message.md`, which is a gitignored scratch file.
 *
 * Advisory, like check-docs.mjs, and for the same reason: a broken link is not
 * a broken build, and a blocking check would teach --no-verify. `--strict` is
 * for a CI step that wants the exit code.
 *
 * USAGE
 *
 *   node scripts/check-links.mjs           # report everything, exit 0
 *   node scripts/check-links.mjs --quiet   # print only problems
 *   node scripts/check-links.mjs --strict  # exit 1 if any problem
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = join(REPO, ".claude");
const SKIP = new Set([join(ROOT, "docs", "commit-message.md")]);

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const strict = argv.includes("--strict");

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".md") && !SKIP.has(full)) out.push(full);
  }
  return out;
}

const rel = (p) => relative(REPO, p).split(sep).join("/");

// ---------------------------------------------------------------------------
// Headings → anchors, the way GitHub renders them: lower-case, punctuation
// dropped, EACH space to a hyphen (so `Lifecycle & Seeding` becomes
// `lifecycle--seeding` — the dropped `&` leaves two spaces, and they are not
// collapsed), repeats suffixed -1, -2, …
// ---------------------------------------------------------------------------

const headingCache = new Map();

function slug(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // keep link text, drop target
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/ /g, "-");
}

function anchorsOf(file) {
  if (headingCache.has(file)) return headingCache.get(file);
  const seen = new Map();
  const anchors = new Set();
  let inFence = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  headingCache.set(file, anchors);
  return anchors;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function insideInlineCode(line, index) {
  // An odd number of backticks before the match means we are inside a span.
  return (line.slice(0, index).match(/`/g) ?? []).length % 2 === 1;
}

const problems = [];
let checked = 0;

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n");
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    for (const m of line.matchAll(LINK)) {
      const target = m[1];
      if (/^(https?:|mailto:|<)/i.test(target)) continue;
      if (insideInlineCode(line, m.index)) continue;
      checked++;

      const hash = target.indexOf("#");
      const pathPart = hash === -1 ? target : target.slice(0, hash);
      const fragment = hash === -1 ? null : decodeURIComponent(target.slice(hash + 1));
      const where = `${rel(file)}:${i + 1}`;

      let dest = file;
      if (pathPart) {
        dest = resolve(dirname(file), pathPart);
        if (!existsSync(dest)) {
          problems.push(`${where}: ${target} — file not found`);
          continue;
        }
      }
      if (fragment === null || fragment === "") continue;
      if (!dest.endsWith(".md") || statSync(dest).isDirectory()) continue;
      if (!anchorsOf(dest).has(fragment.toLowerCase())) {
        problems.push(`${where}: ${target} — no heading for #${fragment} in ${rel(dest)}`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (problems.length === 0) {
  if (!quiet) console.log(`links: ${checked} checked under .claude/, none dead.`);
  process.exit(0);
}

console.log("");
console.log(`links: ${problems.length} dead of ${checked} checked under .claude/ —`);
for (const p of problems) console.log(`      ${p}`);
console.log("");
if (strict) {
  console.log("links: --strict — exiting 1.");
  process.exit(1);
}
console.log("Advisory only — nothing here blocks a push. Fix the link or the heading it names.");
console.log("");
process.exit(0);
