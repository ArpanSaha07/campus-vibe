---
description: Board drift, stale tasks, blockers, open bugs and CI status — no agents spawned
argument-hint: "(nothing)"
---

Run the standup.

**This spawns no agents.** It reads files and reports. That is deliberate:
twelve agents each saying *nothing since yesterday* costs real money and tells
you nothing. A standup is for spotting drift, and drift is visible in the files.

## Read

- `.claude/team/board/sprint.md` — what is in flight
- `.claude/team/board/deadlines.md` — what is dated
- `.claude/team/digest/latest.md` — when it was last regenerated
- `.claude/TODO/todo.md` — the top of *Next up*
- `.claude/bugs/bugs.md` — open defects
- `git log --oneline -10` and `git status --short` — what actually moved

## Report

Short. Five sections, and skip any that is empty rather than writing *none*.

**Moving** — board rows that changed status since the last standup, and commits
since then. Tie each commit to a board row if you can; a commit with no matching
row is worth flagging, because it means work is happening off-board.

**Stuck** — rows in `blocked`, and rows in `in-progress` with no matching commit
activity. Say what each is waiting on and who owns unblocking it.

**Drifting** — the things that quietly rot:
- A row `in-progress` with no deadline in `deadlines.md`.
- A deadline that has passed with the row not `done`.
- A digest older than about a week.
- Work in the tree that is uncommitted and growing.
- A `todo.md` P0 that nothing on the board is addressing.

**Waiting on Arpan** — everything in `awaiting-arpan`, plus any `Proposed` ADR in
`.claude/docs/decisions/` he has not accepted. These are the cheapest things to
unblock, so list them first among the actions.

**Broken** — open P0/P1 bugs, and CI status if known. Be accurate: CI has never
run on GitHub, so *unknown* is the honest answer until it has.

## Then

End with **at most three concrete next actions**, each with an owner. Not a
summary — actions. If nothing needs doing, say the board is clean and stop.

Do not invent progress. If nothing moved since the last standup, say that. A
standup that always reports momentum is a standup nobody reads.

## Write

Append a dated one-liner to `.claude/team/digest/latest.md` under *Since the last
digest* if anything material changed. Do not write a meeting note — a standup
that produced no decision does not need a file, and `/digest` is what rebuilds
the fuller picture.
