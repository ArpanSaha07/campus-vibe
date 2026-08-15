---
name: implementation-docs
description: Write or update a design-decisions document in .claude/docs/architecture after implementing a feature, backend/frontend module, database change, or CI/CD workflow. Explains what the current code does and why it was built that way, for Arpan and for teammate agents who start with no memory of the work. Use after finishing a unit of work, when asked to document an existing implementation, or when a review asks where the reasoning is written down.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(git log:*), Bash(git diff:*), Bash(git status:*)
---

# Implementation & Design-Decision Docs

`.claude/docs/` is the project's knowledge base: what the code does, and why it
is shaped that way. Every completed unit of work — a feature, a backend module, a
frontend area, a database change, a CI/CD workflow — leaves a document there.

```
.claude/docs/
├── README.md            index — every doc, one line each. Update it or the doc is invisible.
├── architecture/        implementation docs (this file)    — living, describe code as it is
└── decisions/           ADRs                               — dated, frozen, describe a choice
```

This file covers `architecture/`. For `decisions/` — when an ADR is warranted,
how they are numbered, and the template — read [`adr.md`](adr.md).

The split matters. An **ADR** records a choice at the moment it was made and is
never rewritten. An **implementation doc** describes the system as it is today
and is rewritten whenever the system changes. Together they answer *why did we
decide this* and *what did that turn into*.

---

## Who this is written for

Two readers, both real, with different needs. Serve both or the document fails
one of them.

**Arpan.** He did not write the code and will read this weeks later to decide
something. He needs the short version first: what exists now, what it means for
him, and what is not finished. He should never have to read a file-by-file
breakdown to get that.

**A teammate agent starting cold.** Agents keep no memory between sessions. An
agent asked to change authentication next month sees its own definition, its
prompt, and whatever files it reads — nothing else. This document is the only
way anything learned during the original work reaches it. What it needs is the
opposite of a summary: the constraint that forced an odd shape, the alternative
already tried and rejected, the thing that breaks if the code is *simplified*.

Neither reader needs *what the code does line by line* — they can read the code.
Both need the reasoning, which is nowhere else.

---

## When to write one

After a feature works, before moving to the next. CLAUDE.md requires stopping at
that boundary for review anyway — the doc belongs in the same pause, while the
reasoning is still recoverable.

Triggers: a new feature merged · a backend module or API surface added · a
frontend area built · a Flyway migration or schema change · a CI/CD workflow
added or restructured · a significant refactor that changes how something works.

Not for: a one-line fix, a copy change, a dependency bump. Those belong in the
commit message and `fixed_bugs.md`.

**Touching a subsystem that already has a doc counts as a trigger.** Changing
code and leaving its doc describing the old behaviour is worse than having no
doc, because the next reader trusts it.

**You do not have to remember this.** `scripts/check-docs.mjs` maps code paths
to docs (`scripts/docs-map.json`) and reports, on every `git push`, any area you
changed whose doc you did not. It is advisory and never blocks — a stale doc
does not break the build, and a check that blocks would only teach you to reach
for `--no-verify`, which also skips the tests. Run it yourself any time:

```bash
node scripts/check-docs.mjs --base origin/main
```

When it names a doc, there are exactly two honest responses: update the doc, or
— if the change genuinely does not affect what the doc claims — re-read enough
to confirm that and move the stamp. Silence is the third option and it is how
the four `unverified` banners in `docs/architecture/` came to exist.

---

## Who writes it

**The agent that did the work**, not a separate writer. The reasoning lives with
whoever hit the constraint; handing it to someone else loses exactly the part
that is worth keeping.

When several agents built one feature, the one that owned the largest share
drafts it, and each other contributor adds the entries for its own area —
`security` writes the threat reasoning, `qa-automation` writes what the tests
cover and deliberately do not.

Record contributors on the `Authors` line of the status block. It tells a future
reader whether `security` actually reviewed the auth doc or whether `backend`
wrote that section itself, which changes how much weight the section carries.

**Review gate.** `staff-eng` does not APPROVE work whose doc is missing, or
whose *Known gaps* section omits an open finding raised by `security`,
`qa-automation` or `qa-exploratory`. A doc that records only successes is
marketing, and it will be believed.

---

## Update or create?

**Look first.** `ls .claude/docs/architecture/` and read anything on the same
topic.

- Same topic exists → **update it**. Revise the affected sections in place and
  append to its Change log. Do not create a second document that contradicts the
  first; two docs on one topic means neither can be trusted.
- No document covers this topic → create one, and add it to
  `.claude/docs/README.md` in the same edit.
- The work spans two existing topics → update both, each from its own angle.
  Cross-link rather than duplicating.

Name files by topic, kebab-case, no dates or version numbers:
`ci-cd-pipeline.md` · `authentication.md` · `search.md` · `docker-environment.md`

---

## Procedure

### 1. Read the implementation — never document from memory or from a plan

Read every file the document describes, start to finish. A plan describes what
was *intended*; the code is what shipped, and they diverge. If a plan file or an
ADR exists, read it too — but only to recover *why*, and note explicitly where
the implementation departed from it.

`git log --oneline -15` and the diff of the relevant commits recover reasoning
that is not in the code.

### 2. Recover the why

For each significant decision, answer: what problem forced this? What else was
considered? What breaks if someone undoes it?

Sources, in order of reliability: comments in the code (this repo comments the
reasoning, not the mechanism — mine them), `.claude/docs/decisions/`, the plan
file, commit messages, `todo.md` and `bugs.md`, then the conversation.

**If a decision's rationale cannot be recovered, say so** — write
`Rationale not recorded` rather than inventing a plausible one. A confident
wrong explanation is worse than an admitted gap, because it will be believed.

### 3. Write it

Structure below. Then:

- add or update the one-line entry in `.claude/docs/README.md`;
- update `.claude/TODO/todo.md` per CLAUDE.md;
- if the work came out of an ADR, add the `Implemented in:` back-link to it.

---

## Structure

Sections in this order. Drop any that would be empty; do not pad.

### Status block

Date · branch or commit the document describes · `Authors:` the agents who
contributed · whether the implementation is live, partially live, or unverified.

A doc describing code that has never run must say so in the first paragraph —
that is the single most important fact about it.

**Every doc carries a freshness stamp**, on its own line in this block:

```text
**Code as of:** e12cd19
```

It means *the code was read at this commit*, and it is what
`scripts/check-docs.mjs` measures distance from. Two rules keep it honest:

- **Only move it when you have actually re-read the code.** Bumping the stamp
  because the number looked old converts a useful signal into a lie, and the
  checker will then report clean forever.
- **A doc that has never been reconciled with the code writes
  `**Code as of:** never`,** with a sentence saying so. The checker skips those
  deliberately — they are already labelled in their own banner, and repeating it
  on every push is noise that trains you to ignore the whole report.

### In one paragraph

**For Arpan, in plain language.** What this subsystem does, what state it is in,
and the one thing he would want to know before deciding anything about it.
No jargon, no file paths, five sentences at most. Someone who reads only this
paragraph should not be misled about anything that matters.

### Read this before you change anything here

**For a cold-starting agent.** Three to six bullets: the files that carry the
real logic, the docs and skills that bind this area, the one invariant that is
easy to break. This is the entry point that makes the folder a knowledge base
rather than an archive — it tells the next agent where to start rather than
making it re-derive the map.

### Overview

Two or three paragraphs. What this subsystem does, where it sits, and the one
architectural idea a reader must hold to make sense of the rest.

### File-by-file breakdown

**One subsection per file.** For each: what it is responsible for, when it runs
or is invoked, and what it would catch or produce that nothing else does.

This is the section the reader navigates by, so it must map one-to-one onto the
files on disk. A file that exists and is not listed reads as an oversight.

### Design decisions

The core of the document. Split into:

- **General** — decisions shaping the whole subsystem.
- **Task-specific** — one entry per notable file or mechanism.

Each entry states the decision, the problem that forced it, the alternative
rejected and why, and the consequence of reverting it. Prose or a table, but
every entry needs all four. A decision without a rejected alternative is usually
not a decision — it is a default, and does not need an entry.

Cite the ADR where one exists: `(ADR-004)`. The ADR holds the debate; this entry
holds the outcome as it actually shipped.

### Known deviations, gaps and blockers

What does not work, what is deliberately deferred, what will break under a
foreseeable change. Cross-reference `bugs.md` IDs, and name every open finding
from a security or QA review of this work.

Write this section honestly even when it is unflattering. A document that omits
the known-failing test is actively harmful — the next reader trusts it and is
blindsided.

### Possible improvements

Concrete and prioritised, with the trigger for doing each one — *why not yet* is
as useful as *what*. Distinguish improvements that are blocked on something
external from ones that are merely unscheduled.

### Change log

Dated one-line entries, newest last, each naming the author. Every update to the
document appends one.

---

## Rules

**Describe what the code does now, not what it will do.** Aspirations go under
Possible improvements. Present tense for current behaviour; never write as if
planned work already exists.

**Never document a file you have not read.** If it was skipped, name it as
undocumented rather than guessing from its filename.

**No double quotation marks in prose** — single quotes, italics or backticks.
House style across `.claude/` documents. Verbatim code is the one exception:
quote a shell or YAML line exactly as it appears, never silently reformatted to
satisfy this rule.

**Numbers must be measured.** Timings, sizes, test counts and cost figures are
either verified or clearly marked as estimates. An invented benchmark is
indistinguishable from a real one to the next reader.

**Cite `file:line` for claims about the codebase**, matching the evidence
standard in `bugs.md`. A claim a reader cannot check is a claim they have to
re-derive.

**Link, do not duplicate.** Point at `database-lifecycle/SKILL.md`, `todo.md`,
an ADR or a bug ID rather than restating them. Restated rules go stale silently,
and the copy is what people read.

**Line-wrap at roughly 80 characters** and keep code blocks short — quote the
three lines that carry the decision, not the whole file.
