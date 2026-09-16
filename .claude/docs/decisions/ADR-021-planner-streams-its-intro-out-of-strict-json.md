# ADR-021 — The planner streams its intro out of one strict-JSON completion

**Status:** Proposed
**Date:** 2026-09-16
**Decided in:** the planner backend `/start` session, recorded in
[`2026-09-16-planner-backend.md`](../../specs/2026-09-16-planner-backend.md)
**Participants:** main session · **Approved by:** Arpan chose the option on
2026-09-16; the record itself awaits his status change
**Implemented in:** `ai/client/OpenAiLlmClient.java`,
`ai/feature/planner/IntroStreamReader.java`, `PlannerAnswers.java` — see
[`ai-planner.md`](../architecture/ai-planner.md)

## Context

[ADR-019](ADR-019-planner-answer-is-intro-plus-typed-picks.md) fixed the shape
of a planner answer: an intro that streams as `delta` frames, then typed picks
`{kind, id, reason}` in a closing `done` frame. It named its own cost: the
backend must get structured picks from the model *after, or alongside,* text it
has already streamed, and it left how to the backend unit.

Three constraints bound the choice:

- Arpan chose streamed replies on 2026-09-15, so the intro must appear as it is
  written, not after the whole answer.
- The picks are validated against this message's candidates and rendered as
  cards; they must be reliably machine-readable.
- Each message is spent from a 15-per-day quota and billed per token.

## Options considered

### Two calls: a streamed intro, then structured picks

Stream a plain-text intro, then make a second, non-streamed call with a JSON
schema for the picks.

- **For:** each call does one simple thing; the intro stream needs no parsing.
- **Against:** roughly double the tokens and the wait, since the second call
  re-reads the prompt and candidates. The intro is written before the picks
  exist, so it can describe items the second call does not choose.
- **Not taken.**

### One call: plain text, a delimiter, then a JSON block

Ask for the intro as prose, a fixed delimiter line, then the picks as JSON, and
split the stream at the delimiter.

- **For:** one call; the intro streams as-is up to the delimiter.
- **Against:** nothing enforces the format. A model that skips, misspells or
  repeats the delimiter streams JSON to the user or loses the picks, and the
  failure is silent until someone sees it.
- **Not taken.**

### One call with a strict JSON schema, intro first

One streamed call whose output must match a strict schema
`{intro, kind, picks[{id, reason}]}`, with `intro` the first property. The server
decodes the intro string out of the partial JSON as it arrives and sends it as
`delta` frames, then parses the whole answer when the stream ends.

- **For:** one call per message. The provider enforces the shape, so a
  parseable answer is the normal case, not the hoped-for one. The intro and the
  picks are written in one pass and can agree. `kind: none` gives the model a
  legitimate way to say nothing fits.
- **Against:** the server must decode a JSON string from fragments that split
  anywhere, including inside escapes and surrogate pairs. Streaming depends on
  the provider emitting properties in schema order. It ties the planner to a
  provider that supports strict structured output while streaming.
- **Taken.**

## Decision

The planner makes one streamed Chat Completions call per message with a strict
`json_schema` response format, `intro` first. `IntroStreamReader` decodes the
intro from the partial output for `delta` frames; if the answer does not open
with the intro, it streams nothing and the parsed intro is sent in one piece
before `done`. The stored answer always comes from a full JSON parse, never
from the streamed text, and its picks are then kept only if they name this
message's candidates.

## Consequences

- **Easy:** validation works on real data; an unparseable or truncated answer is
  a clean failure that is refunded and stores nothing.
- **Costs:**
  - `IntroStreamReader` is parsing code the project owns, tested against split
    escapes and surrogate pairs.
  - The prompt must keep the reason convention (continuing a sentence that
    starts with the item's name) in words; the schema cannot express it.
- **Forecloses:** streaming the reasons one by one without further parsing; a
  provider without streamed structured output, without replacing this.

## Revisit when

- A second provider is added and cannot stream a strict schema, or does not
  emit properties in schema order.
- Streaming each pick's reason as it is written becomes a request (ADR-019's
  own trigger).
- The live answer log shows answers routinely failing to parse or dropping
  picks, which would question strict output as the reliable path.
