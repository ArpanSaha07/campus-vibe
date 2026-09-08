---
name: start
description: Start, begin, kick off or pick up a unit of work on CampusVibe. Orients from the decisions index and the one relevant doc, asks Arpan about everything still undecided, then writes a short spec to .claude/specs/ for approval before any code is written.
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(ls:*)
---

# Starting a unit of work

Nothing here is code. This produces one short, committed spec that says what was
agreed, so the next session — always a fresh one — does not re-derive it or
quietly contradict it.

**Stop at step 4.** Arpan approves and commits the spec before implementation
starts. A spec written after the code is a description, not an agreement.

## 1. Orient — four reads, not forty

`STATUS.md` has already arrived with the session; do not re-read it.

1. [`docs/decisions/README.md`](../../docs/decisions/README.md) — the ADR index,
   and the decisions still waiting to be written. Read this **before** the doc.
   A choice already settled must not be silently remade, and one already
   *proposed* is not yours to flip.
2. [`docs/README.md`](../../docs/README.md) — the index, then **the one document**
   it names for this area. Not all of them.
3. `grep` [`todo.md`](../../TODO/todo.md) and [`bugs/bugs.md`](../../bugs/bugs.md)
   for the item. Grep, never read whole — both are large on purpose.
4. `grep` [`tasks-completed.md`](../../TODO/tasks-completed.md) for anything that
   sounds like what you are about to build. It may already exist.

**If the work is a bug fix, add one more:** grep
[`fixed_bugs.md`](../../bugs/fixed_bugs.md) for the *file* you are about to
touch, not the symptom. A second bug in the same method is a trap that survived
its first fix — that wants a line in `.claude/rules/` with both bug ids, not
another point fix. `ClubService.create` cost two bugs this way (BUG-034, then
BUG-037) before anyone noticed the pattern.

Rules for the files you will touch load by themselves when you read them. Do not
go hunting for them now.

## 2. Ask — never decide for Arpan

List every point the reading did not settle: an ambiguous requirement, a choice
between two designs, a schema shape, anything touching an existing invariant.

Put them to Arpan with `AskUserQuestion`. This is the hard rule in
[`CLAUDE.md`](../../CLAUDE.md): never assume a decision, taken or open. A
reasonable-looking guess is the expensive kind, because it looks decided
afterwards.

If a question is genuinely a choice between real alternatives with a lasting
consequence, it is an ADR rather than a spec line. Say so, and let Arpan decide
whether to open one first.

## 3. Write the spec

`.claude/specs/YYYY-MM-DD-<slug>.md`, following
[`specs/README.md`](../../specs/README.md):

- **Goal** — one paragraph. What is true after this ships that is not true now.
- **Out of scope** — what a reader would reasonably assume is included and is not.
- **Decisions taken** — one line each, naming who decided. Arpan decided anything
  that was open; cite the ADR where one exists.
- **Open questions** — what is still unanswered and what it blocks.
- **Files expected to change** — from `scripts/docs-map.json`: the code, plus the
  docs and rules mapped to it.
- **Verification** — the exact commands that will prove it works.
- **To update at wrap-up** — docs, rules, ADRs, the STATUS line. `/wrap-up`
  reads this section.
- `Status: draft`

Keep it short. A section growing into an argument belongs in an ADR; link to it.

## 4. Stop

Report what the spec says, what Arpan still has to decide, and what you propose
to do first. Then wait. No code, no migrations, no branches.
