// node --test scripts/pr-checks.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkTitle,
  checkTemplate,
  checkSize,
  countLines,
  parseFiles,
} from "./pr-checks.mjs";

const template = readFileSync(
  new URL("../.github/pull_request_template.md", import.meta.url),
  "utf8",
);

test("a semantic title passes", () => {
  assert.deepEqual(checkTitle("feat(clubs): let owners pin an event"), []);
  assert.deepEqual(checkTitle("fix: return results for semantic-only queries"), []);
});

test("a non-semantic, capitalised, full-stopped or long title warns", () => {
  assert.equal(checkTitle("Fixed stuff").length, 1);
  assert.equal(checkTitle("feat(clubs): Pin an event").length, 1);
  assert.equal(checkTitle("feat(clubs): pin an event.").length, 1);
  assert.equal(checkTitle("feat: " + "a".repeat(80)).length, 1);
  assert.equal(checkTitle("").length, 1);
});

test("the untouched template warns on spec, what and why, and testing", () => {
  assert.equal(checkTemplate(template).length, 3);
});

test("an empty body warns on all three", () => {
  assert.equal(checkTemplate("").length, 3);
});

test("a filled template passes", () => {
  const body = template
    .replace(/^Spec:.*$/m, "Spec: docs/specs/2026-11-24-pinned-events.md")
    .replace("## What and why", "## What and why\n\nClub owners can pin one event to the top of their page.")
    .replace("- [ ] `node scripts/verify.mjs` passes", "- [x] `node scripts/verify.mjs` passes");
  assert.deepEqual(checkTemplate(body), []);
});

test("free-text testing evidence counts even with no box ticked", () => {
  const body = template
    .replace(/^Spec:.*$/m, "Spec: n/a")
    .replace("## What and why", "## What and why\n\nOne-line fix.")
    .replace("## How I tested", "## How I tested\n\nRan ClubServiceTest; all green.");
  assert.deepEqual(checkTemplate(body), []);
});

test("lockfiles do not count toward the size", () => {
  const files = [
    { filename: "frontend/package-lock.json", additions: 9000, deletions: 9000 },
    { filename: "frontend/app/page.tsx", additions: 30, deletions: 10 },
  ];
  assert.equal(countLines(files), 40);
  assert.deepEqual(checkSize(files), []);
});

test("over 4,000 changed lines warns", () => {
  const files = [{ filename: "backend/A.java", additions: 3000, deletions: 1001 }];
  assert.equal(checkSize(files).length, 1);
  assert.deepEqual(checkSize([{ filename: "b", additions: 2000, deletions: 2000 }]), []);
});

test("parseFiles reads one JSON object per line", () => {
  const files = parseFiles('{"filename":"a","additions":1,"deletions":2}\n\n{"filename":"b","additions":3,"deletions":0}\n');
  assert.equal(countLines(files), 6);
});
