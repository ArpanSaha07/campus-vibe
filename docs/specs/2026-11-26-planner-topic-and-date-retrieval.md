# Planner retrieval honours the topic and the day a prompt names

**Status:** shipped (uncommitted, 2026-11-26) · **Date:** 2026-11-26

## Goal

Asked for *tech events happening today*, the planner offers today's tech events and
nothing else. On 2026-11-26 the local database held 16 events that day, five of them
tech (ids 7, 8, 32, 33, 31 the next day), and the planner offered Bake Sale and Women
in Tech's Game Night while missing the GDG McGill workshop *Building AI Voice Agents*
(id 7, tagged `software-development`, `ai-machine-learning`). Measured causes, against
the seeded data:

- the keyword leg ORs every prompt word (`SearchRepository.java:172`), so *event*,
  *happen* and *today* match 18 of 30 events, and any hit skips `min-score`
  (`SearchRepository.java:204`);
- *tech* never matches the tags, because `Technology` stems to `technolog`; every real
  tech event scores keyword 0;
- the organizer name is in the event text, so every Women in Tech event matches *tech*;
- *today* never narrows retrieval: 30 days compete for 15 candidate slots;
- `PlannerRanker` boosts the student's profile interests but never the topic the
  prompt names.

After this ships, a prompt that names a topic and a day gets candidates filtered to
both, the keyword leg no longer rewards filler words or club names, the model is told
a club's name alone does not make an event fit, and an evaluation set pins it.

## Out of scope

- Club candidates: no topic or date filtering of clubs. They gain only the filler-word
  change, through the shared keyword query.
- The search box (`/api/v1/search`): its queries are untouched.
- A new LLM or embedding call per message, and any migration (synonyms stay in code).
- Retuning the existing `PlannerRanker` weights beyond what the topic fallback adds;
  the evaluation set comes first, tuning later.
- Topics or dates inferred by the model; detection is deterministic and server-side.

## Decisions taken

- **Topic: filter, falling back to a boost** — Arpan, 2026-11-26. When the prompt names
  a topic and at least **one** event in the window matches it, only matching events are
  offered; with none, matching is moot and the normal ranking runs. A match is the
  event's topic slug or a child of it (`interest_catalogue.parent_slug`), so *tech*
  covers `tech`, `software-development`, `ai-machine-learning`, `web-development`,
  `data-science`.
- **Topic detection: catalogue labels and slugs plus a synonym map in Java** — Arpan,
  2026-11-26. No migration, no extra API call. Parent topics expand to their children.
- **Date: filter to the named range**, in Montreal time through `PlannerDay` — Arpan,
  2026-11-26. Every event source (search, saved or going, followed clubs, previous
  answer, soonest) is narrowed to it, still under ADR-020's `end_time > now()`.
- **An empty range offers no events** — Arpan, 2026-11-26. The model answers kind none
  and says nothing is on then; the 30-day window is not widened.
- **Filler words dropped from the planner's keyword query** (a planner-specific list:
  *event*, *happening*, *today*, *suggest*, *recommend* and the like), and a keyword
  hit no longer bypasses the score gate unconditionally — Arpan, 2026-11-26.
- **Organizer name weighted below title and tags** in the event keyword text
  (`setweight`) — Arpan, 2026-11-26.
- **Prompt rule** in `planner-system.txt`: when the student names a topic, only events
  about it fit; an organizer's name alone does not — Arpan, 2026-11-26.
- **Evaluation set** (todo P3, `todo.md:295`) built in this unit — Arpan, 2026-11-26.
- **No ADR**: the decisions live here and move to `ai-planner.md` at wrap-up; nothing in
  ADR-019, 020 or 023 is overturned — Arpan, 2026-11-26.

- **Phrases** — Arpan, 2026-11-26, as proposed: *today* = now to Montreal midnight;
  *tonight* = now or 17:00, whichever is later, to 04:00 next day; *tomorrow* = the next
  Montreal day; *this weekend* = Friday 17:00 to Monday 00:00, from now if already in
  it; *next week* = next Monday to the Monday after.
- **Follow-ups** — Arpan, 2026-11-26, as proposed: topic and range are each taken from
  the current prompt, else from the previous one.
- **The keyword gate** — Arpan, 2026-11-26, as proposed: `OR kw > 0` becomes a minimum
  keyword rank for the planner query, its value chosen from the evaluation set.
- **Synonyms** — Arpan, 2026-11-26, as proposed: *tech, technology, coding,
  programming, software, dev, developer, AI, ML, machine learning, data, web,
  hackathon*.

## Open questions

None.

## Where the work departed from this spec

- **`PlannerRanker` is unchanged.** With a threshold of one matching event the
  filter leaves nothing for a fallback boost to act on, so none was added.
- **The organizer weighting and keyword gate apply to the planner's event
  query only**; the club query keeps `kw > 0`, since a club's name is what it
  is about. The search box is untouched, as agreed.
- **Window bounds are bound from Java's `now`**, not Postgres's `now()`, which
  the evaluation set needs to pin its calendar; still ADR-020's rule.
- **Verification:** `verify.mjs --backend --full` green; the frontend build
  could not run ([BUG-069](../bugs/bugs.md#bug-069)); the by-hand `/planner`
  check was not done and is queued in `todo.md`.

## Files expected to change

Code (all mapped to `docs/architecture/ai-planner.md` in `scripts/docs-map.json`,
except `SearchRepository`, mapped to `search.md`):

- `backend/.../ai/feature/planner/PlannerRetrievalService.java` — apply topic and date
  filters across sources.
- `backend/.../ai/feature/planner/PlannerCandidateRepository.java` — sources take a
  range instead of only `windowDays`.
- new `backend/.../ai/feature/planner/PlannerIntent.java` (name open) — pure parser:
  prompt to topic slugs and a date range; synonym map here.
- `backend/.../ai/feature/planner/PlannerRanker.java` — topic-match boost for the
  fallback path.
- `backend/.../search/SearchRepository.java` — planner query: filler words, organizer
  weight, keyword gate, range bounds.
- `backend/src/main/resources/prompts/planner-system.txt` — the topic rule.
- Tests: new `PlannerIntentTest`, `PlannerRankerTest`, `PlannerPromptBuilderTest`, and a
  new evaluation IT (e.g. `PlannerRetrievalEvalIT`) seeding a fixed set of events.

Docs: `docs/architecture/ai-planner.md`, `docs/architecture/search.md`,
`docs/TODO/todo.md` (close the P3 evaluation item).

## Verification

- `cd backend && ./mvnw -B verify -DskipITs` — unit tests, including the parser cases
  for each phrase and the 25-hour day.
- `node scripts/verify.mjs --full` — the ITs, including the evaluation set. Its first
  case: *suggest tech events happening today* against a seeded day mirroring
  2026-11-26 returns all of that day's tech events and none of Bake Sale, Soul Food,
  Game Night, Slime Making.
- By hand, `node scripts/dev.mjs --jar`, then the same prompt on `/planner` against the
  local seed: the GDG workshop (id 7) appears.

## To update at wrap-up

- `docs/architecture/ai-planner.md` — retrieval: the intent parser, filtering by topic
  and range, the fallback, the empty-range answer; remove *Ranker weights are
  guesses. No evaluation set exists.* (`ai-planner.md:575`).
- `docs/architecture/search.md` — the planner query's filler words, weighting and gate.
- `.claude/rules/backend-java.md` or a planner line: the stemming trap (*tech* never
  matches *Technology*) and filler words in an any-word tsquery, with the bug id if one
  is opened.
- `docs/TODO/todo.md:295` moved to `tasks-completed.md`.
- `STATUS.md` shipped line; this spec to `shipped`.
