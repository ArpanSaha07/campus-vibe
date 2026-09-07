#!/usr/bin/env node
/**
 * SessionStart hook — print where the project is, before anything is asked.
 *
 * WHY THIS EXISTS
 *
 * Every feature here is built in a fresh session, and the expensive part of
 * that is not the code: it is the ten minutes of reading that establishes what
 * already exists, what is broken, and which traps are armed. CLAUDE.md used to
 * send sessions to the foot of a 26 KB queue to find out, which cost tokens and
 * still missed the traps.
 *
 * So the answer arrives unasked. .claude/STATUS.md is the one file that says
 * where the project stands, and this prints it, with the branch, the last
 * commits and the working tree around it.
 *
 * WHY IT REPORTS ITS OWN STALENESS
 *
 * STATUS.md is written by hand at the end of a unit of work, so it is only ever
 * as current as the last /wrap-up. A digest that is silently three weeks old is
 * worse than none — it is read with the confidence of something current. The
 * `Code as of:` stamp is the same key check-docs.mjs uses; if HEAD has moved
 * past it, the drift is stated in the same breath as the content.
 *
 * On a shallow clone (`git clone --depth 1`, which is what the @claude GitHub
 * Action gets) the stamp's commit is not in the history, so the count comes
 * back empty. That is not evidence of drift, so nothing is claimed.
 *
 * IT NEVER FAILS
 *
 * A hook that blocks a session over its own bug is a worse trade than a session
 * with no orientation. Every git call degrades to null, the whole body is
 * wrapped, and the exit code is always 0.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const STATUS_PATH = join(REPO, ".claude", "STATUS.md");

const LOG_COUNT = 8;
const TREE_LINES = 10;

function git(args) {
  const res = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

function fenced(title, body) {
  return ["", `## ${title}`, "", "```", body, "```"];
}

function build() {
  const out = [];
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = git(["rev-parse", "--short", "HEAD"]);

  out.push("## Session context");
  out.push("");
  out.push(
    `Branch \`${branch ?? "unknown"}\` at \`${head ?? "unknown"}\`. ` +
      "Rules in `.claude/rules/` load by themselves when you read a file they " +
      "match, so the traps for a subsystem arrive with its code — do not go " +
      "looking for them up front.",
  );

  if (!existsSync(STATUS_PATH)) {
    out.push("");
    out.push(
      "`.claude/STATUS.md` is missing. Orient from `.claude/CLAUDE.md` and the log below.",
    );
  } else {
    const text = readFileSync(STATUS_PATH, "utf8");
    const stamp = text.match(/^\*\*Code as of:\*\*\s*`?([0-9a-f]{7,40})`?/m);

    if (stamp) {
      // Empty or null means the stamped commit is not in this history — a
      // shallow clone, or a sha that never landed. Make no claim either way.
      const behind = git(["rev-list", "--count", `${stamp[1]}..HEAD`]);
      if (behind && Number(behind) > 0) {
        out.push("");
        out.push(
          `**STATUS.md was written ${behind} commit(s) ago.** Treat *Now* and ` +
            "*Recently shipped* below as possibly stale; `/wrap-up` refreshes them.",
        );
      }
    }

    out.push("");
    out.push(text.trim());
  }

  const log = git(["log", "--oneline", `-${LOG_COUNT}`]);
  if (log) out.push(...fenced("Last commits", log));

  const tree = git(["status", "--short"]);
  if (tree) {
    const lines = tree.split("\n");
    const shown = lines.slice(0, TREE_LINES).join("\n");
    const extra =
      lines.length > TREE_LINES ? `\n... and ${lines.length - TREE_LINES} more` : "";
    out.push(...fenced("Uncommitted in the working tree", shown + extra));
  }

  return out.join("\n");
}

try {
  console.log(build());
} catch (err) {
  console.log(`## Session context\n\nOrientation hook failed (${err.message}). Read \`.claude/STATUS.md\`.`);
}

process.exit(0);
