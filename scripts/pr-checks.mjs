#!/usr/bin/env node
/**
 * PR checks for pull requests into `develop`: title, template and size.
 *
 * WARNINGS ONLY. Every finding is printed as a GitHub `::warning::` annotation
 * and the script exits 0. Arpan decided all three should guide, never block
 * (spec 2026-11-23-teammate-pr-workflow). A crash still exits non-zero, because
 * a broken checker should be fixed rather than quietly report nothing.
 *
 * Run by .github/workflows/pr-checks.yml. Locally:
 *
 *   PR_TITLE='feat(clubs): pin an event' PR_BODY="$(cat body.md)" \
 *     node scripts/pr-checks.mjs files.jsonl
 *
 * files.jsonl holds one {"filename","additions","deletions"} object per line,
 * as `gh api --paginate repos/O/R/pulls/N/files --jq '.[] | {...}'` prints it.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The same pattern as .githooks/commit-msg. A squash merge uses the PR title as
// the commit subject, and the hook never sees that commit, so this is the only
// place it is checked.
export const TITLE_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: [a-z0-9`].*[^.]$/;
export const TITLE_MAX = 72;

export const SIZE_LIMIT = 4000;

// Lockfiles are excluded from the size count (Arpan, 2026-11-23): one
// dependency bump can rewrite thousands of their lines.
const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

export function isLockfile(path) {
  return LOCKFILES.has(path.split("/").pop());
}

export function checkTitle(title) {
  const t = (title ?? "").trim();
  if (t.length > TITLE_MAX) {
    return [`PR title is ${t.length} characters; the limit is ${TITLE_MAX}.`];
  }
  if (!TITLE_PATTERN.test(t)) {
    return [
      "PR title is not semantic. Use type(scope): summary, lowercase, no full stop, " +
        "for example feat(clubs): let owners pin an event. The squash commit takes this title.",
    ];
  }
  return [];
}

/** Text of a `## Heading` section, without HTML comments. Empty string if absent. */
export function section(body, heading) {
  const lines = stripComments(body).split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

function stripComments(text) {
  return (text ?? "").replace(/<!--[\s\S]*?-->/g, "");
}

// The unchecked boxes the template ships with. A section holding only these
// has not been filled in.
const TEMPLATE_TESTED_LINES = new Set([
  "- [ ] `node scripts/verify.mjs` passes",
  "- [ ] tried it in the local stack (`docker compose up`)",
]);

export function checkTemplate(body) {
  const warnings = [];
  const b = body ?? "";

  const specLine = stripComments(b)
    .split(/\r?\n/)
    .find((l) => /^\s*spec:/i.test(l));
  const spec = specLine ? specLine.replace(/^\s*spec:/i, "").trim() : "";
  if (!spec) {
    warnings.push(
      "No spec linked. Fill the Spec: line with the approved spec in docs/specs/, or n/a for a one-line fix.",
    );
  }

  if (!section(b, "What and why")) {
    warnings.push("The What and why section is empty.");
  }

  const tested = section(b, "How I tested");
  const real = tested
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !TEMPLATE_TESTED_LINES.has(l.toLowerCase()));
  if (real.length === 0) {
    warnings.push(
      "The How I tested section is not filled in. Tick what you ran and say what you saw.",
    );
  }

  return warnings;
}

export function countLines(files) {
  let total = 0;
  for (const f of files) {
    if (isLockfile(f.filename)) continue;
    total += (f.additions ?? 0) + (f.deletions ?? 0);
  }
  return total;
}

export function checkSize(files) {
  const total = countLines(files);
  if (total > SIZE_LIMIT) {
    return [
      `This PR changes ${total} lines (lockfiles excluded); the guideline is ${SIZE_LIMIT}. ` +
        "Consider splitting it: migration and backend, then the contract, then the UI.",
    ];
  }
  return [];
}

export function parseFiles(jsonl) {
  return jsonl
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function main() {
  const filesPath = process.argv[2];
  const files = filesPath ? parseFiles(readFileSync(filesPath, "utf8")) : [];

  const results = [
    ["Title", checkTitle(process.env.PR_TITLE)],
    ["Template", checkTemplate(process.env.PR_BODY)],
    ["Size", checkSize(files)],
  ];

  const summary = ["## PR checks (warnings only, never block)", ""];
  for (const [name, warnings] of results) {
    for (const w of warnings) console.log(`::warning title=PR ${name.toLowerCase()}::${w}`);
    summary.push(`- **${name}:** ${warnings.length ? warnings.join(" ") : "ok"}`);
  }
  summary.push("", `${countLines(files)} changed lines, lockfiles excluded.`);
  console.log(summary.join("\n"));

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
