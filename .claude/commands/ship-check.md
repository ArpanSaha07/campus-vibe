---
description: Pre-deploy gate — five agents must each sign off; any BLOCK stops it
argument-hint: "(optional: what is being shipped)"
---

Run the ship check for: **$ARGUMENTS**

This is the gate before anything is deployed. Five agents sign off independently.
**Any `BLOCK` stops it.**

---

## Say the truth about deployment first

Nothing is deployed today and no deployment target exists — no AWS account, no
registry, no OIDC role. If this ship-check is being run against a real intent to
deploy, say that plainly before spending the tokens, because the prerequisites
are in `.claude/TODO/todo.md` and none of them are met.

Running it as a **readiness rehearsal** is still worthwhile: it tells you what
would block a deploy if one were possible. Be explicit about which of the two
this is.

---

## Establish what is being shipped

Read `git status --short`, `git log --oneline -10` and the current branch. State
the actual diff under review. A ship-check on an unstated scope is meaningless —
the agents will each assume something different.

## Run all five in parallel

Each gets the diff scope, the branch, and this instruction: **return
`APPROVE`, `REQUEST-CHANGES` or `BLOCK` on the first line**, then the reasoning
with `file:line`.

- **`security`** — secrets, authn/authz, exposure, dependency risk. **Holds a
  veto.** A credential anywhere in history, an authz bypass, or a token in a log
  is `BLOCK`.
- **`qa-automation`** — is the changed behaviour actually proven? Untested new
  behaviour on a user-facing path is at least `REQUEST-CHANGES`. Report the real
  suite result, including the known BUG-001 failure.
- **`qa-exploratory`** — drive the running app. A broken main path is `BLOCK`.
  If the stack will not start, say so — that is itself a finding.
- **`devops`** — do the images build, does the stack boot, is CI green, are
  secrets sourced from the environment rather than baked in? CI has never run on
  GitHub; if that is still true, it is a `BLOCK` on shipping, not a footnote.
- **`staff-eng`** — does the combined change hold together, and is anything
  half-finished in a way that will be discovered in production?

## Report

**Lead with the verdict**: `CLEARED` only if all five returned `APPROVE`.
Otherwise `NOT CLEARED`, and name every agent that did not approve.

Then, in order:

1. Every `BLOCK`, with who raised it and what would clear it.
2. Every `REQUEST-CHANGES`, grouped by owner.
3. What each approver said they checked — an `APPROVE` with no stated scope is
   worth less, and it is worth noticing which ones are thin.
4. What **nobody** checked. This is the most valuable line in the report and the
   easiest to omit.

**Never soften a `BLOCK`.** Do not average five verdicts into *mostly fine*. One
agent blocking is the whole point of having five.

---

## Then stop

**Arpan decides whether to ship. You never deploy.** Not even if all five
approve — the gate produces a recommendation, not an action.

Write the outcome to
`.claude/team/meetings/YYYY-MM-DD-ship-check-<slug>.md`: the scope, all five
verdicts verbatim, what blocked, and what was not checked. This is the record
that matters most later, when something breaks in production and the question is
whether anyone had looked at it.

Anything blocking goes onto `.claude/team/board/sprint.md` with an owner.
