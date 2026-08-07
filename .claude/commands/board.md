---
description: Render the sprint board, per-agent load and what is waiting on you
argument-hint: "(optional: an agent name, to see just their load)"
---

Show the board. **Spawns no agents** — this reads files.

If `$ARGUMENTS` names an agent, show only that agent's tasks and skip the
overview.

## Read

- `.claude/team/board/sprint.md` — in flight
- `.claude/team/board/deadlines.md` — dated commitments
- `.claude/team/members/*.md` — per-agent task lists
- `.claude/docs/decisions/` — any ADR still `Proposed`
- `.claude/TODO/todo.md` — the top of *Next up*, for what is queued next

## Show

**In flight** — the sprint table as it stands, grouped by status, most urgent
first. Blocked rows at the top, because a blocked row is the one costing time.

**Per-agent load** — a row per agent with a task, showing count and status.
Skip agents with nothing; a table of twelve rows where nine are empty is noise.
Flag anyone with more than two `in-progress` tasks — an agent doing three things
at once is doing none of them.

**Waiting on Arpan** — everything in `awaiting-arpan`, plus every `Proposed`
ADR. Put this first if it is non-empty. These are the cheapest unblocks
available and they are the ones that go stale silently.

**Dates** — overdue first, then due within three days. Say the number of days,
not just the date; *3 days ago* reads faster than a date the reader has to
subtract.

**Inconsistencies** — the board is hand-maintained, so check it against reality
and report mismatches rather than trusting it:

- a task in `members/<agent>.md` with no sprint row, or the reverse;
- a row marked `done` still sitting on the board (it should be deleted and
  recorded in `todo.md`);
- a deadline for a task that is not on the board at all;
- a row whose source link points at a `todo.md` line or BUG id that no longer
  exists.

## Then

If the board is empty, say so plainly and show what is queued next from
`todo.md` instead — an empty board with a full backlog means nothing has been
assigned, which is worth naming.

Do not edit anything. `/board` reports; `/kickoff` and `/standup` write.
