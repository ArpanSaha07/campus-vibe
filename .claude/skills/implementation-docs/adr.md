# Architecture Decision Records

An ADR records **one decision, at the moment it was made**, and is then frozen.
It lives at `.claude/docs/decisions/ADR-NNN-<slug>.md`.

This is the other half of the knowledge base described in
[`SKILL.md`](SKILL.md). The difference is worth being precise about, because
writing the wrong one wastes the effort:

| | ADR | Implementation doc |
|---|---|---|
| Answers | why we chose this | what it turned into |
| Written | **before** the code | **after** the code |
| Lifetime | frozen once accepted | rewritten whenever the code changes |
| When wrong | superseded by a new ADR | edited in place |
| Lives in | `.claude/docs/decisions/` | `.claude/docs/architecture/` |

An ADR is never edited to reflect a change of mind. That is the whole value: it
preserves what was known and believed at the time, including the options that
looked reasonable and were rejected. Editing it destroys the record of a
decision that was made on incomplete information — which is the thing a future
reader most needs to understand.

---

## When to write one

- A `/kickoff` or `/all-hands` reaches a decision. The meeting note records the
  discussion; the ADR records the outcome.
- A choice constrains future work: a library, a data model, an auth transport, a
  deployment target, a testing boundary.
- A choice was contested, or the rejected option was genuinely attractive.
- A decision is reversed. Write a **new** ADR that supersedes the old one; do not
  edit the original.

**Not** for: choices with an obvious default and no real alternative, anything
reversible in an afternoon, or implementation detail with no downstream
consequence. If nobody could reasonably have chosen otherwise, it is not a
decision.

Roughly: if the answer to *what else did we consider* is nothing, skip it.

---

## Numbering

Sequential, zero-padded to three digits, never reused: `ADR-001`, `ADR-002`.
Take the next number by listing `.claude/docs/decisions/`. Two ADRs written in
the same session take consecutive numbers — do not batch them under one.

The slug is the decision, not the area: `ADR-004-jwt-in-httponly-cookie.md`,
not `ADR-004-auth.md`.

---

## Template

```markdown
# ADR-NNN — <the decision, stated as a claim>

**Status:** Proposed | Accepted | Superseded by [ADR-NNN](ADR-NNN-slug.md)
**Date:** YYYY-MM-DD
**Decided in:** [meeting note](../../team/meetings/YYYY-MM-DD-kickoff-slug.md)
**Participants:** agents who weighed in · **Approved by:** Arpan
**Implemented in:** [doc](../architecture/topic.md) — added when the work lands

## Context

The situation forcing a choice. What is true today, what constraint applies,
what breaks if nothing is decided. Cite `file:line` for claims about the code.

## Options considered

One subsection each, including the one chosen. For every option: what it is,
what it costs, and why it was or was not taken. An ADR listing a single option
is not recording a decision.

## Decision

What we are doing, in one or two sentences. Unambiguous enough that an agent
reading it alone knows what to build.

## Consequences

What this makes easy, what it makes hard, and what it forecloses. Include the
costs — an ADR with only upsides was not a real evaluation.

## Revisit when

The condition that should make someone reopen this. `Revisit if we add a second
client`, `revisit when traffic exceeds X`. Without this, a decision made under
today's constraints silently outlives them.
```

---

## Rules

**Status starts at `Proposed` and only Arpan moves it to `Accepted`.** Agents
propose; the go/no-go is his. An `Accepted` ADR that he never approved is a
process failure, not a shortcut.

**Record the rejected options in enough detail to be re-evaluated.** The
commonest ADR failure is a rejected option described only as *worse* — which
tells a future reader nothing, and guarantees the same debate is had again.

**Cite `file:line` for claims about the codebase**, the same evidence standard
as `bugs.md` and the implementation docs.

**Add the `Implemented in:` link once the work lands.** This is the one edit an
accepted ADR ever receives, and it is what connects the decision to its result.
If the implementation departed from the decision, the *implementation doc* says
so — the ADR still stands as the record of what was decided.

**No double quotation marks in prose** — single quotes, italics or backticks.
House style across `.claude/` documents.
