# ADR-019 — A planner answer is an intro plus typed picks, not prose with inline markers

**Status:** Proposed
**Date:** 2026-09-16
**Decided in:** the planner chat UI `/start` session, recorded in
[`2026-09-16-planner-chat-ui.md`](../../specs/2026-09-16-planner-chat-ui.md)
**Participants:** main session · **Approved by:** Arpan chose the option on
2026-09-16; the record itself awaits his status change
**Implemented in:** [`ai-planner.md`](../architecture/ai-planner.md) — the
frontend half; the backend that produces the shape is unbuilt

## Context

The approved AI planner plan (Unit 2, *Grounded output*) had the model write one
prose reply citing items inline as `[[event:123]]` and `[[club:slug]]`, which
the server would parse, validate against the retrieved candidates and strip.

The design Arpan approved on 2026-09-16 lays an answer out in a fixed order: a
short intro, **one** row of event or club cards, one line per card saying why it
fits, then follow-up prompts. Arpan also ruled that an answer never carries more
than one card row. The page was then built first, before any backend, so the
shape of an answer had to be fixed before the server that produces it exists.

## Options considered

### Prose with inline markers (the plan)

The reply streams as ordinary text; markers become links, and cards are drawn
after the first paragraph.

- **For:** streams naturally from end to end; one field to store; the model
  explains picks in its own flow.
- **Against:** the layout depends on the model writing paragraphs in the order
  the design needs. Nothing guarantees an intro paragraph, one line per pick, or
  that lines and cards correspond. The per-pick lines under the row have no
  source except re-parsing prose. Mixed events and clubs in one reply are easy
  to write and hard to render as one row.
- **Not taken.**

### Intro plus typed picks

A message is `content` (the intro) plus `picks: [{kind, id, reason}]`. The intro
streams as `delta` frames; the picks, the hydrated `EventDTO` / `ClubDTO` rows,
usage and the chat summary arrive in one `done` frame.

- **For:** the design is rendered from data, not inferred from text. The card
  row, the line per pick and the follow-up chips each have exactly one source.
  Validation stays as the plan had it: the server keeps only ids from this
  turn's candidate set. The frontend enforces one kind per answer
  (`adapters.ts:215`) and drops a pick with no hydrated row.
- **Against:** the reasons do not stream, so the lower half of an answer appears
  at once when the reply completes. The backend must get structured output from
  the model after, or alongside, streamed text, which is more work than parsing
  markers out of one stream. `reason` is written to continue a sentence that
  starts with the item's name, a convention the prompt must hold.
- **Taken.**

### Fully structured, nothing streamed

The whole answer arrives as one JSON document.

- **For:** simplest to validate.
- **Against:** Arpan chose streamed replies on 2026-09-15; a multi-second blank
  wait is what streaming was chosen to avoid.
- **Not taken.**

## Decision

An assistant message is intro text plus a list of typed picks, all of one kind.
The intro streams; the picks, their hydrated cards, usage and the chat summary
come in the closing `done` frame. The inline marker scheme in the plan is
withdrawn.

## Consequences

- Unit 2 produces `{content, picks, events, clubs}` per message and the `done`
  frame described in `ai-planner.md`; the stored message keeps the picks'
  kinds, ids and reasons rather than only `event_ids` / `club_ids` arrays.
- The frontend never parses model text. A reply that mixes kinds loses the
  minority kind silently; the prompt should forbid mixing rather than rely on
  that.
- A reader sees the intro build up and the cards arrive together, never cards
  appearing one by one.
- Forecloses citing an item in the middle of the intro as a link; the intro is
  plain text.

## Revisit when

- An answer needs more than one row, for example events **and** the clubs that
  run them. That breaks the one-kind rule, which is Arpan's, not this record's.
- The chosen provider cannot return structured picks reliably after a streamed
  intro, and a single pass would need markers again.
- Streaming the reasons one by one becomes a request.
