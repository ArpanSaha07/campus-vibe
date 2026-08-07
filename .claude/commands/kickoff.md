---
description: Feature kickoff — light by default (3 agents), --full for architectural work (6+)
argument-hint: "[--full] <feature or problem>  —  e.g. --full decide the JWT transport"
---

Run a kickoff for: **$ARGUMENTS**

If `$ARGUMENTS` is empty after stripping flags, ask what the kickoff is about and
stop.

---

## Which mode

Parse the leading flag. **Light is the default** — the expensive path must be
chosen deliberately, never reached by forgetting a flag.

| Mode | Agents | Rounds | Use for |
|---|---|---|---|
| **light** *(default, or `--light`)* | `pm`, `sparring`, one implementer | 2 | Almost everything: a defined feature, a bug with design choices, wiring existing UI to an endpoint |
| **`--full`** | 6+, including `staff-eng` | 4 | Genuinely architectural work, or anything that closes a door later |

**Cheaper is not cheap.** Light still runs two Opus agents plus an implementer.
If the question has a clear owner and no real decision in it, `/ask` them
instead — that is one agent and it is the right tool far more often than either
mode here.

Say which mode you are running and roughly why before you spawn anything, so it
can be stopped.

---

## Before you spawn anyone — both modes

Read `.claude/team/CHARTER.md`, `.claude/team/board/sprint.md` and
`.claude/TODO/todo.md`. If this work is already queued, say at what priority. A
kickoff for a P3 while a P0 is open is worth questioning out loud before
spending anything.

---

# Light mode

Two rounds, three agents.

## Round 1 — is this the right problem, and is it a bad idea?

Spawn **`pm`** and **`sparring`** in parallel.

- `pm`: whose problem is this, the smallest version that solves it, acceptance
  criteria, what is out of scope.
- `sparring`: the strongest case against doing this at all, or now. Give it the
  request **verbatim**, not `pm`'s framing, which would bias it.

**If `sparring` returns a fatal objection, stop and put it to Arpan.** That is
the ritual paying for itself — killing a bad plan for two agents instead of six.

## Round 2 — how would we build it?

Spawn **one implementer** — the owner from `ROSTER.md`, usually `backend`,
`frontend`, `ai-eng` or `devops`. Pass it `pm`'s scope and `sparring`'s surviving
concerns.

Ask for: the approach, files it would touch, what it would **reuse**, what it
would need from other agents, where it is uncertain, and **what it would not do
and why**.

## The escalation check — do not skip this

Light mode has no `staff-eng` round, so **you** are the one who has to notice
when it is out of its depth. After round 2, check the plan against these. Any hit
means light mode is not enough:

| If the work… | It needs |
|---|---|
| touches auth, tokens, roles, permissions, uploads, or user input | `security` |
| adds or changes a Flyway migration | `staff-eng` — schema contracts |
| adds a dependency | `security` **and** `staff-eng` |
| creates new UI, or changes an existing screen's structure | `design` |
| changes the API contract between backend and frontend | the **other** implementer |
| changes CI, the merge gate, or a Dockerfile | `devops` **and** `staff-eng` |
| adds user-visible copy or a new public page | `growth` |

**Prefer targeted escalation over jumping to `--full`.** Spawn the one or two
agents the table named, pass them the plan, and fold their answers in. That costs
one extra agent, not four. Say clearly that you escalated and why.

Go to `--full` only when three or more rows hit, or when the plan turns out to be
architectural after all. Say so and let Arpan decide whether to spend it.

---

# Full mode (`--full`)

Four rounds. Each round's output is the next round's input; within a round,
spawn in parallel. Every agent starts cold, so pass the prior rounds' substance,
not a summary of a summary.

**Round 1 — is this the right problem?** `pm` and `sparring`, exactly as in light
mode, including the stop-on-fatal-objection rule.

**Round 2 — what would it look like?** In parallel, only those the work touches:
`design` (any UI — spec plus states), `growth` (anything users see or that
affects discoverability), `security` (auth, roles, tokens, uploads, user input —
threat model **before** implementation, not after). Pass each `pm`'s scope and
`sparring`'s surviving concerns.

**Round 3 — how would we build it?** The implementers that own the area —
`backend`, `frontend`, `ai-eng`, `devops` as applicable, in parallel. Same asks
as light mode's round 2, including what each would *not* do.

**Round 4 — does this hold together?** `staff-eng`, with everything above. It
returns a verdict and, more importantly, catches the seams: where two agents
assumed different things, where the plan duplicates something that already
exists, where the pieces do not fit.

If it returns `REQUEST-CHANGES`, use `SendMessage` to take the affected agent
back through one more round rather than re-running the whole ritual.

---

## Then stop — both modes

**Arpan decides.** Present:

1. **The recommendation**, in one paragraph — what to build, what to leave out.
2. **The strongest objection** and whether it changes the answer.
3. **What this makes permanent** — the door it closes.
4. **The proposed tasks**: owner, what, dependencies.
5. **Open questions** you could not resolve.
6. **In light mode: what was not checked.** Name the perspectives that did not
   run — no `staff-eng` coherence pass, no security review, no design review —
   so the cost saving is visible as a trade rather than hidden.

Then **wait**. Nothing is implemented from a kickoff. Do not assign tasks, do not
spawn an implementer to start, do not create board rows until he says go.

## After he decides

Write these, or the ritual was theatre:

1. **Meeting note** → `.claude/team/meetings/YYYY-MM-DD-kickoff-<slug>.md`.
   Record the mode used, who was consulted, what each said in substance, and
   **where they disagreed**. A note where everyone agreed usually lost the
   interesting part. In light mode, record which perspectives were skipped.
2. **ADR** → `.claude/docs/decisions/ADR-NNN-<slug>.md`, per
   `.claude/skills/implementation-docs/adr.md`. Status `Proposed` unless Arpan
   explicitly accepted it. Take the next free number by listing the folder.
   Skip only if nothing structural was decided — and say that you skipped it.
   **A light kickoff that produced an ADR-worthy decision should probably have
   been `--full`.** Note that in the meeting note; it is how the mode boundary
   gets calibrated.
3. **Board rows** → `.claude/team/board/sprint.md`, one per task with a named
   owner, and the same task appended to that agent's `members/<name>.md`.

If no decision was reached, the note is still written and records **`NO
DECISION`** and why.

Finally, confirm the trace: `git diff --stat .claude/team/ .claude/docs/` should
show what changed. If it shows nothing, the ritual produced only opinions — say
so plainly rather than summarising as though it worked.
