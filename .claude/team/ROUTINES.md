# Scheduled routines

Two routines run the team's automation. **Neither is created yet** — see
Prerequisites. The prompts below are ready to use as-is.

The on/off switch is [`AUTOMATION.md`](AUTOMATION.md), which both prompts read as
their first action.

---

## They run in the cloud, not on this machine

This is the constraint that shapes everything below. A routine spawns an isolated
cloud session that **clones the GitHub repository**. It cannot see:

- this laptop, `D:\CampusVibe\campus-vibe`, or anything uncommitted;
- Docker, the running stack, or the database;
- `docker/.env` or any local secret.

So a routine can only read **what is committed and pushed**, and it reports
rather than verifies. Nothing that needs the app running belongs in one — that is
`/ship-check` on demand, not a schedule.

## Prerequisites — why they are not created yet

1. **Commit and push `.claude/team/` and `.claude/agents/`.** A cloud agent
   cloning `main` today finds none of this and the routine fails on first run.
2. **Confirm the Claude GitHub App can reach `ArpanSaha07/campus-vibe`.** The
   access check was inconclusive when this was written. Run `/web-setup`, or
   install the app at
   <https://claude.ai/code/onboarding?magic=github-app-setup>.
3. **Decide whether the digest routine may commit.** Regenerating
   `digest/latest.md` in a cloud checkout is thrown away unless it opens a PR.
   Two honest options: let it **report** the digest without writing (simple, and
   the file goes stale), or let it **open a PR** against the digest file
   (accurate, but a PR most days). Recommended: report-only to start, so the
   routine proves useful before it earns write access.

Creating them before these are true produces two routines that fail daily and
train you to ignore their notifications.

---

## Routine 1 — daily digest

**Name:** `campusvibe-daily-digest`
**Schedule:** `0 11 * * *` — 11:00 UTC = **07:00 America/Toronto**
**Model:** `claude-sonnet-5`
**Repo:** `https://github.com/ArpanSaha07/campus-vibe`

```text
You are the CampusVibe team's daily digest routine. You are running in an
isolated cloud checkout of the repository. You cannot see Arpan's laptop, the
running application, Docker, or any uncommitted work — only what is committed
and pushed. Never claim to have verified anything you could not observe.

STEP 1, before anything else: read .claude/team/AUTOMATION.md and find the
line beginning '**Status:'. If it says `paused`, stop immediately — produce no
report, read nothing further, write nothing. If the file is missing or you
cannot parse that line, also stop and say the switch was unreadable, so it
fails closed rather than running unattended.

If the status is `active`, continue.

Read: .claude/team/board/sprint.md, .claude/team/board/deadlines.md,
.claude/team/digest/latest.md, .claude/TODO/todo.md, .claude/bugs/bugs.md,
.claude/docs/decisions/, and `git log --oneline -20`.

Produce a report, under 400 words, with exactly these sections, omitting any
that would be empty rather than writing 'none':

1. CHANGED — commits since the date at the top of digest/latest.md, and any
   board row whose status moved. Tie commits to board rows where you can; a
   commit with no matching row means work is happening off-board, which is
   worth naming.
2. DRIFTING — a row in-progress with no commit activity; a passed deadline
   whose row is not done; a digest older than a week; a P0 in todo.md that no
   board row addresses.
3. WAITING ON ARPAN — board rows in awaiting-arpan, plus every ADR in
   .claude/docs/decisions/ still marked Proposed. List these first among the
   actions; they are the cheapest things to unblock and they rot silently.
4. BROKEN — open P0 and P1 bugs by id. State CI status only if the repository
   actually shows a run; if no workflow has ever run, say exactly that rather
   than inferring.
5. NEXT — at most three concrete actions, each with an owner.

Rules: do not invent progress. If little changed, the report gets shorter —
say so. Do not spawn subagents; this is a file-reading task and twelve agents
reporting 'nothing since yesterday' costs money and says nothing. Do not
commit, push, or open a PR. Do not edit any file, including the digest itself.
```

## Routine 2 — deadline watch

**Name:** `campusvibe-deadline-watch`
**Schedule:** `0 12 * * 1-5` — 12:00 UTC = **08:00 America/Toronto**, weekdays
**Model:** `claude-sonnet-5`
**Repo:** `https://github.com/ArpanSaha07/campus-vibe`

```text
You are the CampusVibe deadline watch. You run in an isolated cloud checkout
and can only see what is committed and pushed.

STEP 1, before anything else: read .claude/team/AUTOMATION.md and find the
line beginning '**Status:'. If it says `paused`, stop immediately and produce
no report. If the file is missing or unparseable, also stop and say so — fail
closed.

If active, read .claude/team/board/deadlines.md and .claude/team/board/sprint.md.

Get today's date with `date -u +%Y-%m-%d`. Do not infer it.

Report only these, and nothing else:

- OVERDUE — a deadline past today whose row is not done. Say how many days
  over. List these first.
- DUE WITHIN 3 DAYS — with the number of days remaining.
- IN PROGRESS WITHOUT A DEADLINE — sprint rows marked in-progress that have no
  row in deadlines.md. Usually fine; worth seeing.

If all three sections are empty, reply with exactly one line: 'No deadlines
overdue or approaching.' Do not pad it.

You report only. Do not reassign work, do not reprioritise, do not chase, do
not edit any file, do not commit or push. Deadlines are Arpan's to set and to
move.
```

---

## Creating them, once the prerequisites are met

Run `/schedule` and give it the name, cron and prompt above, or create directly
with `RemoteTrigger` using `environment_id: env_01Rwri19qMUQDmWYDf1KegVa`.

After creating, record the routine ids here so `/team status` can compare the
live list against this file:

| Routine | ID | Created |
|---|---|---|
| `campusvibe-daily-digest` | *(not created)* | — |
| `campusvibe-deadline-watch` | *(not created)* | — |

**Routines cannot be deleted from here** — only disabled via
`RemoteTrigger update` with `enabled: false`, or removed at
<https://claude.ai/code/routines>. `/team pause` is the intended off switch and
needs neither.

## Two things to expect

**Times are UTC.** Both crons above are converted from America/Toronto. They will
drift by an hour when daylight saving changes — the routine will fire at 06:00 or
08:00 local instead. Adjust the cron then, or accept the hour.

**A paused routine still costs a little.** It wakes, reads one file, and exits.
That is the deliberate trade in `AUTOMATION.md`: a few hundred tokens per skipped
run, in exchange for a switch that cannot lose the schedule definition.
