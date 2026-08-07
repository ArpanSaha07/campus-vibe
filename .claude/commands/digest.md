---
description: Regenerate digest/latest.md from commits, board, bugs and docs
argument-hint: "(nothing)"
---

Regenerate `.claude/team/digest/latest.md`. **Spawns no agents.**

This file is read by **every agent on every spawn**, so it is the highest-leverage
file in the team folder — and the one most likely to quietly go stale and start
misleading twelve agents at once.

## Rebuild it from evidence

Do not edit the old digest in place. Rebuild each section from:

- `git log --oneline -20` and `git status --short` — what actually changed
- `.claude/team/board/sprint.md` — what is in flight
- `.claude/bugs/bugs.md` — open defects, current severity
- `.claude/docs/decisions/` — ADRs, and their status
- `.claude/team/meetings/` — anything decided since the last digest
- `.claude/TODO/todo.md` — the top of *Next up*

## Sections

Keep the existing structure and the existing order, since agents learn where to
look:

1. **Since the last digest** — what changed, newest first. Real commits with
   short hashes, plus decisions. Preserve the previous entries; this is a rolling
   log, not a snapshot. Trim entries older than about a month.
2. **In flight** — from the board. One line each.
3. **Broken or unverified** — the things most likely to bite an agent that
   assumes otherwise. Every open bug with its id, plus unverified claims like
   *CI has never run on GitHub*. This is the section that earns the file.
4. **Uncommitted work in the tree** — if any. Agents that do not know about
   uncommitted work will re-derive or duplicate it.
5. **Open questions heading for an ADR.**

## Rules

**Under 100 lines.** Every agent pays this cost on every spawn, twelve times over
in a full ritual. Detail belongs behind links, not here.

**Only what an agent would act differently knowing.** A digest that lists
everything is a digest nobody reads carefully, and then the one line that
mattered gets skimmed past.

**Say when something is unverified.** *CI has never run on GitHub* is the single
most useful line in the current digest, because it stops an agent assuming a
green pipeline.

**Do not invent progress.** If little changed, the digest gets shorter. Padding it
to look busy is how it stops being trusted.

Update the `Generated:` date and the branch at the top.

## Then

Report what changed between the old and new digest in a couple of lines — new
bugs, closed bugs, newly stale claims. If nothing material changed, say so; that
is a fine outcome and it means the file was already accurate.
