# Working Agreement

How this team operates. Binding on every agent. Where this and a role definition
disagree, this file wins.

---

## Definition of done

A task is done when **all** of these are true. Not four of five.

1. The code works, and you have **run something that proves it** — a test, a
   build, a request against the running app. *It compiles* is not evidence.
2. Tests exist for the behaviour, and they would **fail** if the behaviour broke.
   A test that passes against a stubbed-out implementation tests nothing.
3. `./mvnw verify` (backend) or `npm run lint && npm run type-check && npm test`
   (frontend) passes, or you state exactly what fails and why.
4. The subsystem's doc in [`../docs/architecture/`](../docs/README.md) is written
   or updated — **part of the work, not a follow-up.**
5. [`todo.md`](../TODO/todo.md) is updated; any bug found or fixed is recorded in
   [`bugs.md`](../bugs/bugs.md) / [`fixed_bugs.md`](../bugs/fixed_bugs.md).
6. `staff-eng` has reviewed it and returned `APPROVE`.

Reporting done when it is not done is the worst failure available to you. It is
worse than missing a deadline, because it removes Arpan's ability to trust any
other status you report.

## Verdicts

Reviewers return one of exactly three words, on the first line, then the
reasoning. Never prose-only approval — *looks good to me* is not a verdict.

| Verdict | Means |
|---|---|
| `APPROVE` | Ship it. You have checked it and you are accountable for that. |
| `REQUEST-CHANGES` | Specific, addressable problems. List each with `file:line` and what to do instead. |
| `BLOCK` | Do not proceed. A security hole, data loss, a broken merge gate, or a decision that needs Arpan. |

`BLOCK` is not a stronger `REQUEST-CHANGES`. It means *stop and escalate*, and it
is the only verdict Arpan is always shown.

**Agreeing with everything is a failure mode.** If you review a change and find
nothing, say what you checked and why it is sound. A reviewer who never returns
`REQUEST-CHANGES` is not adding a gate, and will be treated as one that is
broken.

## Evidence standard

The whole `.claude/` tree already works this way — match it.

- Claims about this codebase cite **`file:line`**. `SearchRepository.java:47`, not
  *the search repository*.
- Numbers are **measured or marked as estimates**. An invented benchmark is
  indistinguishable from a real one to the next reader.
- **Never describe a file you have not read.** If you skipped it, name it as
  unread. Guessing from a filename is how confident wrong answers happen.
- If you cannot recover why something is the way it is, write
  `Rationale not recorded` rather than inventing something plausible.

## Where things get written

| Artifact | Goes to | Lifetime |
|---|---|---|
| Why the code is shaped this way | [`../docs/architecture/`](../docs/README.md) | Rewritten as the code changes |
| A decision, at the moment it was made | [`../docs/decisions/`](../docs/decisions/) | Frozen once accepted |
| What was discussed in a ritual | [`meetings/`](meetings/) | Append-only history |
| What you personally learned | [`members/<you>.md`](members/) | Your memory across sessions |
| What is in flight | [`board/sprint.md`](board/sprint.md) | Now only |
| The backlog | [`../TODO/todo.md`](../TODO/todo.md) | Long-lived |
| Defects | [`../bugs/bugs.md`](../bugs/bugs.md) | Long-lived |

**`members/<you>.md` is load-bearing.** You have no memory between sessions.
Anything you worked out and did not write there is gone. Record what surprised
you, what you tried that did not work, and what you would tell yourself if you
started this task again cold. Do not record what the code already says.

## Rituals

Every ritual **ends in a written decision plus assigned tasks.** If no decision
was reached, the meeting note records `NO DECISION` and why. A meeting that
produces only opinions is the exact failure this team exists to prevent.

The standing check: after any ritual, `git diff .claude/team/` and
`git diff .claude/docs/` show what was actually decided and assigned. **A ritual
that leaves no trace there was theatre**, and the command that ran it is broken.

## Decisions and approval

- Agents **propose**. Arpan **decides**.
- Nothing is implemented before he gives a go-ahead. Nothing is deployed, ever,
  without an explicit one.
- An ADR's status only moves to `Accepted` when he says so. An agent marking its
  own proposal `Accepted` is a process failure, not a shortcut.
- Anything that costs money, touches production, sends email, or cannot be undone
  stops and asks first.

## Writing code

- **One feature at a time**, then stop. Standing instruction from `claude.md`.
- Implementers work in **isolated git worktrees**, so two agents running in
  parallel cannot clobber each other. You do not merge; you return a diff.
- Reuse before you build. This repo has `app/components/ui/`,
  `app/lib/services/`, `app/lib/validators/`, and a full Spring service layer.
  A second implementation of something that exists is a defect.
- Match the surrounding code — its naming, its layering, its comment density.
  This repo comments *reasoning*, not mechanism. Comment the same way.
- **Reviewers do not edit code.** `staff-eng` may write only to its own
  `members/staff-eng.md`. A reviewer who fixes the code cannot then review it.

## Stopping

**Three attempts at the same problem with no progress → stop and report.** From
`claude.md`, and it binds agents too. Say what you tried, what you observed, and
what you would try next. A fourth attempt is almost never the one that works, and
a stuck agent burning tokens silently is worse than a stuck agent that says so.

Also stop and ask when: the task is ambiguous in a way that changes the outcome,
you would need to widen scope to finish, or finishing would require a decision
that is Arpan's.
