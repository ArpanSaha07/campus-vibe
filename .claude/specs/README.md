# Specs — what each unit of work agreed to before it started

One file per feature, `YYYY-MM-DD-<slug>.md`, written by `/start` and approved by
Arpan **before any code is written**. A spec is short and it is committed, which
is the whole point: the decisions behind a feature currently survive only in the
session that made them, and the next session — which is always a fresh one —
re-derives or silently contradicts them.

A spec is not a design doc. It records what was agreed, not how it works; once
the work ships, *why the code is shaped this way* moves to
[`../docs/architecture/`](../docs/README.md) and a real choice between
alternatives becomes an ADR in [`../docs/decisions/`](../docs/decisions/README.md).
The spec then gets `Status: shipped` and stays as the record of what was in
scope at the time.

## The shape

```markdown
# <feature>

**Status:** draft | approved | shipped · **Date:** YYYY-MM-DD

## Goal
One paragraph. What is true after this ships that is not true now.

## Out of scope
The things a reader would reasonably assume are included and are not.

## Decisions taken
One line each, naming who decided. Arpan decides anything not already settled.

## Open questions
What is still unanswered, and what it blocks.

## Files expected to change
From `scripts/docs-map.json` — the code, and the docs and rules mapped to it.

## Verification
The exact commands that prove it works.

## To update at wrap-up
Docs, rules, ADRs, STATUS line. `/wrap-up` reads this section.
```

## Rules

- **`/start` writes it; Arpan approves it.** Never pick for Arpan on an open
  question — ask with `AskUserQuestion` and record the answer under *Decisions
  taken*.
- **One spec per unit of work**, matching the one-feature-at-a-time rule in
  [`../CLAUDE.md`](../CLAUDE.md).
- **Keep it short.** If a section is growing into an argument, it belongs in an
  ADR; link to it from *Decisions taken*.
- **Shipped specs stay.** They are the only dated record of what a feature was
  supposed to be, which is what makes a later *was this deliberate?* answerable.
