# ADR-023 — The planner acts on the account through server-validated tool calls, before its streamed answer

**Status:** Accepted 2026-11-16
**Date:** 2026-11-16
**Decided in:** the planner agent `/start` session, recorded in
[`2026-11-16-planner-agent.md`](../../specs/2026-11-16-planner-agent.md)
**Participants:** main session · **Approved by:** Arpan, in the session, 2026-11-16
**Supersedes in part:** [ADR-021](ADR-021-planner-streams-its-intro-out-of-strict-json.md) —
its *one completion per message*. Its streamed strict-JSON final answer stands.
**Extends:** [ADR-019](ADR-019-planner-answer-is-intro-plus-typed-picks.md) —
the answer gains a list of performed actions beside its picks.
**Implemented in:** [`ai-planner.md`](../architecture/ai-planner.md) —
`PlannerToolExecutor`, `PlannerTools`, the loop in `PlannerReplyService`, V37;
2026-11-16, uncommitted

## Context

The planner recommends and does nothing else. A student who reads *this club
fits you* still has to leave the chat to follow it, RSVP, bookmark the event or
add it to Google Calendar. Arpan asked on 2026-11-16 for the chat to become an
agent that can do those things, and settled four points in the `/start`
session:

- The agent is the existing `/planner`, with its chats, limits and pages, not a
  second chat surface.
- Following a club, RSVPing and saving an event act **directly**; undoing each
  (unfollow, cancel RSVP, unsave) is in scope too. Google Calendar is
  **confirmed by the student**, and stays the template link
  (`frontend/app/lib/google-calendar.ts`): no OAuth grant, no stored token.
- A turn costs one message from the daily quota however many actions it takes.
- *Participate*, *going* and *book* mean RSVP; *bookmark* and *save* mean bookmark.

What the code offers today:

- Every action already exists as an idempotent service method:
  `MyClubService.follow` / `unfollow` (`MyClubService.java:70`, `:89`) and
  `MyEventService.saveEvent` / `unsaveEvent` / `rsvp` / `cancelRsvp`
  (`MyEventService.java:72`–`:91`). `rsvp` checks only that the event exists,
  not that it has not ended (ADR-020).
- `LlmClient` has one method, `streamStructured` (`LlmClient.java:32`): one
  streamed Chat Completions call with a strict `json_schema` response format
  (`OpenAiLlmClient.java:82`, `:180`). Nothing can return a tool call.
- The prompt carries event descriptions written by clubs
  (`PlannerPromptBuilder`), so text the student did not write reaches the
  model. Today the worst it can do is bend a recommendation; with actions it
  could write to the account.

## Options considered

### A tool-calling loop ahead of the streamed answer

Offer the model function tools — `follow_club`, `unfollow_club`, `rsvp_event`,
`cancel_rsvp`, `save_event`, `unsave_event`, `offer_calendar_link` — beside the
existing strict answer schema. A round that returns tool calls is executed by
the server against the services above, as the signed-in user, and its results
are sent back to the model; a round that returns content is the answer,
streamed and parsed exactly as ADR-021 has it. At most 4 tool rounds per turn,
then the model must answer.

- **For:** the model sees each result before it writes, so *you already follow
  this club* or *that event has ended* reaches the student truthfully. Adding
  the next tool is one schema and one executor. A turn without actions is still
  one call.
- **Against:** a turn that acts costs two or more calls. The client must read
  tool-call deltas from the stream, not only content. Tool rounds do not
  stream, so the student waits before the first `delta`; a status frame can
  cover it.
- **Recommended.**

### Actions as a field of the strict answer

Add `actions[{type, id}]` to the existing schema; the server executes them
after the full parse.

- **For:** still one call per message; no tool-call parsing; ADR-021 untouched.
- **Against:** the intro is written before anything runs, so it claims
  *I followed X* even when X failed, was already followed or named an ended
  event, and the server can only contradict it under the text. No chaining: the
  model cannot act on what an earlier action returned.
- **Not taken.**

### A new agent runtime (OpenAI Responses API or an agents SDK)

Move the planner onto a provider-hosted agent loop with built-in tool handling.

- **For:** the loop, retries and tool-call parsing are the provider's.
- **Against:** replaces the client the planner, its retry rules and its watchdog
  (`OpenAiLlmClient.java:116`, `:146`) were built and tested on, for four tools.
  Ties the planner more tightly to one provider than the strict schema already
  does.
- **Not taken.**

## Decision

The planner turn becomes a bounded loop: up to 4 tool rounds, then the
existing streamed strict-JSON answer. Every tool argument is validated by the
server before it runs, on rules the model cannot change:

- the user is the JWT principal, never an argument;
- an event to RSVP or save must exist and not have ended (`end_time > now()`,
  ADR-020); a club to follow must exist;
- an id the model acts on must be one of this turn's candidates or already in
  the student's own follows, saves or RSVPs, so text in a description cannot aim
  an action at an arbitrary club or event;
- `offer_calendar_link` writes nothing: it adds the event to the answer, and the
  page renders the existing Add to Google Calendar link. The student's click is
  the confirmation.

Each executed action is reported in the `done` frame as `actions[{type,
targetKind, id, outcome}]` and stored on the assistant message, so a reload and
the next turn's history both show it.

## Consequences

- **Easy:** the student acts without leaving the chat; the reply states what
  actually happened; new tools follow one pattern.
- **Costs:**
  - Two or more provider calls on a turn that acts; still one message of quota.
  - `OpenAiChatStream` must assemble streamed tool-call arguments as well as
    content.
  - An action is written when its tool runs, before the answer exists. If the
    final round then fails, the account has changed although the turn produced
    no answer — the planner's *a failure stores nothing* rule
    (`ai-planner.md`, outcome table) no longer holds for it. The spec carries
    this as an open question.
  - A prompt-injected description can still trigger an action on an id that
    passes validation — a candidate the student is looking at. Accepted with
    the direct-action choice; the action is visible in the reply and undoable.
- **Forecloses:** nothing permanent. Writing to Google Calendar through its API
  is a separate, later decision (an OAuth grant and stored tokens).

## Revisit when

- An action is added that cannot be undone, costs money or reaches another
  person (a message, a booking with a payment, a Calendar API write): it needs
  the confirm-first path, not direct execution.
- A tool's result needs more than 4 rounds in practice, or tool rounds make the
  first `delta` arrive noticeably later than it does today.
- The planner moves to a provider without streamed tool calls.
- A prompt-injected action is seen in production.
