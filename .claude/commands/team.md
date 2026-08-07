---
description: Automation switch and GitHub sync — pause, resume, status, sync
argument-hint: "pause | resume | status | sync   (pause accepts --hard)"
---

Manage the team's automation and its GitHub mirror.

Subcommand is the first word of `$ARGUMENTS`. If it is missing or unrecognised,
show the four options and stop — do not guess.

---

## `pause`

Set `**Status:** \`paused\`` in `.claude/team/AUTOMATION.md`, update the
`Last changed` line to today's date, and confirm which routines will now skip.

Scheduled runs will still wake, read the file, and exit — a few hundred tokens
each. That is the intended trade: a soft flag is recoverable, a deleted cron job
has to be rebuilt from memory.

**`pause --hard`** additionally deletes the cron entries via `CronList` then
`CronDelete`. Show which entries you are about to delete and **ask before
deleting** — recreating them means rewriting the schedule from scratch. After
deleting, still set the file to `paused`, so resuming is a two-step you can see.

## `resume`

Set status to `active` and update `Last changed`.

Then check the routines actually exist — `CronList`. If `pause --hard` removed
them, the file says `active` but nothing is scheduled. Say so and offer to
recreate them, rather than reporting success.

## `status`

Read and report, in this order:

1. `.claude/team/AUTOMATION.md` — the flag and when it last changed.
2. `CronList` — what is actually scheduled and when it last ran.
3. **Any disagreement between the two.** `active` with no cron entries, or
   entries running while `paused`, is the failure worth catching — it is exactly
   the state where you believe automation is working and it is not.
4. When `digest/latest.md` was last generated. Older than a week means agents are
   spawning with a stale picture.

## `sync`

Mirror the sprint board to GitHub Issues, so the board is readable from a phone.

`gh` is installed and authenticated as `ArpanSaha07`; the remote is
`ArpanSaha07/campus-vibe`. Verify with `gh auth status` before starting, and if
that fails, report it and stop.

**This repository is public. Issues are world-readable.** Before creating
anything, check the board rows for anything not meant to be public — an unfixed
security finding above all. A vulnerability that is not yet fixed does **not** go
in a public issue; say so and leave it out.

Procedure:

1. Read `.claude/team/board/sprint.md`.
2. `gh issue list --label campusvibe-board --state all --json number,title,state,body`
   to see what already exists.
3. **Report the plan and stop.** Show exactly what would be created, what would
   be closed, and what is already in sync. Creating issues is outward-facing and
   hard to undo cleanly — **never create without an explicit go-ahead.**
4. Only after Arpan confirms: create with
   `gh issue create --label campusvibe-board --title ... --body ...`, and close
   issues whose board row is gone with `gh issue close`.
5. Each issue body carries the owner, the source link (`todo.md` line or BUG id),
   and a line saying the board file is the source of truth so nobody edits the
   wrong copy.

**One-way, board → GitHub.** Pulling issue edits back would mean two writers for
one file and silent conflicts. If Arpan edits an issue, the board is still
authoritative and the next sync will overwrite it — say that in the report.

If the `campusvibe-board` label does not exist, create it as part of the
confirmed step, not before.

---

## Rules

- **Never commit or push.** `/team` touches `AUTOMATION.md`, cron entries and
  GitHub issues — never the git tree.
- **Never create a GitHub issue without confirmation**, even during `sync`.
- Automation state changes are Arpan's. Report; do not decide to pause because a
  routine looked noisy.
