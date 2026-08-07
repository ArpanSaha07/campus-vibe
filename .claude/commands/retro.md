---
description: What worked, what did not, and what changes in the working agreement
argument-hint: "(optional: a period or a specific piece of work)"
---

Run a retro on: **$ARGUMENTS** — or, if empty, on everything since the last
retro in `.claude/team/meetings/`.

A retro that produces feelings is wasted. This one produces **an edit to
`WORKING-AGREEMENT.md`, or an explicit statement that no rule needs changing.**

---

## Gather the evidence first

Do not ask agents how they felt. Read what actually happened:

- `.claude/team/meetings/` — what was decided, and whether it was then done
- `.claude/team/board/sprint.md` and its history in `git log` — what moved,
  what sat still, what was quietly dropped
- `.claude/docs/decisions/` — decisions made, and whether any were reversed
- `.claude/bugs/bugs.md` and `fixed_bugs.md` — what broke, and what caught it
- `git log --oneline` since the last retro — what actually shipped

The interesting questions are answered by that evidence:

- Did work assigned in a ritual actually get done, or did the board rot?
- Did a review catch something real, or did every reviewer approve everything?
- Was a bug found by a gate that was supposed to find it, or by accident later?
- Did a decision get made twice because nobody wrote it down the first time?
- Did an agent do work outside its charter?

## Ask the team — sparingly

Spawn at most **three** agents, chosen because they were actually involved, plus
**`sparring`** to attack the team's own process rather than the product.

Ask each: what slowed you down, what did you have to re-derive that should have
been written down, and what rule would have prevented the worst thing that
happened.

`sparring` gets a sharper brief: **is this team structure actually earning its
cost?** It should be willing to say that a ritual is theatre, that an agent is
redundant, or that the whole thing is more ceremony than the project needs. That
answer is worth having.

## The one question that matters most

**Did any reviewer return `REQUEST-CHANGES` or `BLOCK`?**

If every review approved everything, the gates are not working — they are
producing the *feeling* of review at full price. That is the failure mode this
team was built to avoid, and it is worth flagging loudly rather than politely.

Similarly: did any ritual leave no trace in `git diff .claude/team/`? Then it was
theatre and the command needs fixing, not repeating.

---

## Produce a change

End with **at most three changes**, each concrete:

- an edit to `.claude/team/WORKING-AGREEMENT.md` (a rule added, changed or
  **deleted** — deleting a rule nobody follows is a real improvement);
- an edit to an agent definition in `.claude/agents/`;
- a change to a ritual command in `.claude/commands/`;
- or *no change needed*, with the reason.

Three at most, on purpose. A retro producing fifteen action items produces none.

**Propose; do not apply.** Arpan approves process changes like any other. Show
the exact diff you would make.

## Write it down

`.claude/team/meetings/YYYY-MM-DD-retro-<slug>.md`: the evidence, what the team
said, the pattern you found, and the proposed changes.

Be honest even where it is unflattering to the team — including about whether
this whole structure is paying for itself. A retro that concludes everything is
going well, every time, is the same as no retro.
