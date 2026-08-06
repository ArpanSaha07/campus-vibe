---
name: implementation-docs
description: Write or update a design-decisions document in .claude/docs after implementing a feature, backend/frontend module, database change, or CI/CD workflow. Explains what the current code does and why it was built that way. Use after finishing a unit of work, or when asked to document an existing implementation.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git log:*), Bash(git diff:*), Bash(git status:*)
---

# Implementation & Design-Decision Docs

Every completed unit of work — a feature, a backend module, a frontend area, a
database change, a CI/CD workflow — gets a document in `.claude/docs/` recording
**what the code currently does** and **why it was built that way**.

The audience is someone who has the code in front of them. They can already see
*what* every line does. What they cannot recover is the reasoning: the
alternative that was tried and rejected, the constraint that forced an odd
shape, the thing that breaks if they *simplify* it. That reasoning is the
document's reason to exist.

---

## When to write one

After a feature works, before moving to the next one. CLAUDE.md requires
stopping at that boundary for review anyway — writing the doc belongs in the
same pause, while the reasoning is still recoverable.

Triggers: a new feature merged · a backend module or API surface added · a
frontend area built · a Flyway migration or schema change · a CI/CD workflow
added or restructured · a significant refactor that changes how something works.

Not for: a one-line fix, a copy change, a dependency bump. Those belong in the
commit message and `fixed_bugs.md`.

---

## Update or create?

**Look first.** `ls .claude/docs/` and read anything on the same topic.

- Same topic exists → **update it**. Revise the affected sections in place and
  add an entry to its Change Log. Do not create a second document that
  contradicts the first; two docs on one topic means neither can be trusted.
- No document covers this topic → create one.
- The work spans two existing topics → update both, each from its own angle.
  Cross-link rather than duplicating.

Name files by topic, kebab-case, no dates or version numbers:
`ci-cd-pipeline.md` · `authentication.md` · `search.md` · `docker-environment.md`

---

## Procedure

### 1. Read the implementation — never document from memory or from a plan

Read every file the document describes, start to finish. A plan describes what
was *intended*; the code is what shipped, and they diverge. If a plan file
exists, read it too — but only to recover *why*, and note explicitly where the
implementation departed from it.

`git log --oneline -15` and the diff of the relevant commits recover reasoning
that is not in the code.

### 2. Recover the why

For each significant decision, answer: what problem forced this? What else was
considered? What breaks if someone undoes it?

Sources, in order of reliability: comments in the code (this repo comments the
reasoning, not the mechanism — mine them), the plan file, commit messages,
`todo.md` and `bugs.md`, then the conversation.

**If a decision's rationale cannot be recovered, say so** — write
`Rationale not recorded` rather than inventing a plausible one. A confident
wrong explanation is worse than an admitted gap, because it will be believed.

### 3. Write it

Structure below. Then update `.claude/TODO/todo.md` per CLAUDE.md, and add the
document to `.claude/docs/README.md` if that index exists.

---

## Structure

Sections in this order. Drop any that would be empty; do not pad.

### Status block

Date, the branch or commit the document describes, and whether the
implementation is live, partially live, or unverified. A doc describing code
that has never run must say so in the first paragraph — that is the single most
important fact about it.

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

### Known deviations, gaps and blockers

What does not work, what is deliberately deferred, what will break under a
foreseeable change. Cross-reference `bugs.md` IDs.

Write this section honestly even when it is unflattering. A document that omits
the known-failing test is actively harmful — the next reader trusts it and is
blindsided.

### Possible improvements

Concrete and prioritised, with the trigger for doing each one — *why not yet* is
as useful as *what*. Distinguish improvements that are blocked on something
external from ones that are merely unscheduled.

### Change log

Dated one-line entries, newest last. Every update to the document appends one.

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

**Link, do not duplicate.** Point at `database-lifecycle/SKILL.md`,
`todo.md`, or a bug ID rather than restating them. Restated rules go stale
silently, and the copy is what people read.

**Line-wrap at roughly 80 characters** and keep code blocks short — quote the
three lines that carry the decision, not the whole file.
