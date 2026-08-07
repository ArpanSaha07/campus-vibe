---
description: Every relevant agent weighs in on one strategic question
argument-hint: "<question>  —  e.g. should we launch with one club or the whole campus?"
---

Run an all-hands on: **$ARGUMENTS**

For questions that cut across the whole product, where you want twelve
perspectives rather than the owner's. If the question has a clear owner, `/ask`
them instead — this is expensive and their answer will be better.

If `$ARGUMENTS` is empty, ask what the question is and stop.

---

## Pick who actually has something to say

**Do not spawn all twelve reflexively.** Read `.claude/team/ROSTER.md` and choose
the agents whose domain genuinely bears on the question, then say who you picked
and who you left out and why. Arpan can add someone back.

A question about launch timing wants `pm`, `growth`, `sparring`, `devops`,
`security`. It does not want `frontend` describing component structure.

Six is usually plenty. Twelve is almost never right.

---

## Run it

Spawn the chosen agents **in parallel**, each with:

- the question verbatim;
- the context they cannot see — where the project actually stands, what has
  already been decided, and any constraint that makes an obvious answer wrong;
- an instruction to answer **from their domain** and to say plainly when the
  question is outside it, rather than producing a generic opinion.

Ask each for a **position**, not a survey: what they think should happen, the
strongest reason, and what would change their mind. Positions can be compared;
balanced overviews cannot.

## Synthesise honestly

This is the part that carries the value, so do not flatten it.

- **Lead with where they disagree.** Agreement is cheap and usually means the
  question was easy. The disagreement is the actual information.
- Say **who** held each position — `security` and `pm` wanting opposite things
  means something different from two agents agreeing.
- Note where an agent was **outside its competence** and said so. That is a
  quality signal, not a gap.
- Do not average the opinions into a mush. If the team split, report a split.

Then give **your own recommendation**, marked clearly as yours, with the reason.

---

## Write it down

**Meeting note** → `.claude/team/meetings/YYYY-MM-DD-all-hands-<slug>.md`:
the question, who was consulted, each position in substance, the disagreements,
what was decided or that nothing was.

If the all-hands settled something structural, also write an **ADR** to
`.claude/docs/decisions/` per `.claude/skills/implementation-docs/adr.md`, status
`Proposed` until Arpan accepts it.

If it produced no decision, write **`NO DECISION`** in the note with the reason,
and say what would need to be true to decide. That is an honest outcome; a note
implying consensus that did not exist is not.

Confirm the trace: `git diff --stat .claude/team/ .claude/docs/`.
