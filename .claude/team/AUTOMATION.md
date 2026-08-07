# Automation switch

**Status: `active`**

Last changed: **2026-08-06** · by: Arpan (initial setup)

---

## What reads this

Every scheduled routine reads this file as its **first action** and exits
immediately if status is `paused`. Nothing else about the routine runs — no file
reads, no agents, no report.

| Routine | Schedule | What it does |
|---|---|---|
| Daily digest | 07:00 daily | Regenerates `digest/latest.md`, flags board drift and stale tasks |
| Deadline watch | 08:00 Mon–Fri | Reads `board/deadlines.md`, flags overdue and approaching |

## The two states

`active` — routines run on schedule.

`paused` — routines wake, read this line, and stop. Costs a few hundred tokens
per skipped run.

That waste is deliberate. The alternative — deleting and recreating cron
entries — loses the schedule definition every time and is far easier to get
wrong. A soft flag in a file is recoverable; a deleted cron job has to be
rebuilt from memory.

## Changing it

```
/team pause      → status: paused
/team resume     → status: active
/team status     → shows this file plus the live cron list
/team pause --hard → deletes the cron entries outright
```

Use `--hard` when stopping for weeks and the token cost of skipped runs actually
matters. Use plain `pause` for anything shorter, and expect to resume.

**Manual invocation always works.** `/standup`, `/digest`, `/board` and every
ritual run on demand regardless of what this file says. Pausing stops the
*schedule*, not the team.

## Rules for a routine reading this

1. Read this file first. Parse the `**Status:**` line.
2. If `paused`, stop. Produce no report, write no files, spawn no agents.
3. If the file is missing or unparseable, **treat it as `paused`** and say so.
   Failing closed is right here: a misfiring routine that writes files
   unattended is worse than one that silently does nothing.
4. Never edit this file. Only `/team` changes it, and only at Arpan's request.
