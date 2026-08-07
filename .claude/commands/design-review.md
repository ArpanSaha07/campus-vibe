---
description: Review a built screen or component against the design direction
argument-hint: "<page, component or route>  —  e.g. the event page, or EventCard"
---

Run a design review of: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask what to review and stop. *Review the frontend* is
too broad to produce anything actionable — pick a screen.

---

## Run these three in parallel

**`design`** — does it match the direction? Tokens, hierarchy, spacing, states,
the ticket-stock voice. Judge against `.claude/design-guidelines.md`, which is
the authority.

**`frontend`** — is it built right? Reuse of `components/ui/`, Server vs Client
boundaries, responsive behaviour, whether the tokens are actually used rather
than approximated with raw values.

**`qa-exploratory`** — what happens when you use it? It must **load the running
app** via the `browser-automation` skill, not read the source. Empty, loading,
error, long text, no image, narrow viewport, keyboard only.

Tell `qa-exploratory` the stack may need starting:
`docker compose -f docker/docker-compose.yml up -d`. If it cannot get the app
running it should say so rather than reviewing from the code — an observation
that was never made is not a finding.

---

## Relay

Group findings by **what a user would notice first**, not by which agent found
them:

1. **Broken** — does not work, or is unusable at some viewport or state.
2. **Off-direction** — works, but is not CampusVibe. Wrong token, invented
   colour, missing perforation on a card, Title Case in a button, a shadow at
   rest.
3. **Missing states** — no empty, loading or error handling. The most commonly
   skipped and the most commonly hit.
4. **Polish** — real but minor.

Where two agents disagree — typically `design` wanting something `frontend` says
is expensive — **say so and give both positions.** Do not resolve it silently;
that is exactly the trade-off Arpan should see.

Cite `file:line` for anything in code, and describe the visual issue in words a
person can check by looking.

---

## Write it down

Findings that need work go to `.claude/team/board/sprint.md` with `frontend` as
owner, or to `.claude/TODO/todo.md` if they are not urgent.

Anything that is a **guidelines gap** rather than a violation — a case
`design-guidelines.md` simply does not cover — goes into `design`'s
`members/design.md` as a candidate for the next guidelines update. Those gaps are
how the design system actually grows.

Genuine defects go to `.claude/bugs/bugs.md` with reproduction steps.

No meeting note unless a decision was made. A review that produced a task list
has already left its trace on the board.
