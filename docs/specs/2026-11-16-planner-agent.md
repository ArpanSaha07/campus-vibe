# The planner becomes an agent: follow, RSVP, save and add to calendar from the chat

**Status:** shipped · **Date:** 2026-11-16

## Goal

A student in `/planner` can ask the chat to follow or unfollow a club, RSVP to
an event or cancel it, save or unsave an event, and add an event to Google
Calendar, and the chat does it. Follow, RSVP and save happen at once and the
reply says what happened; the Calendar action appears in the reply as the
existing Add to Google Calendar link, which the student clicks to confirm. The
planner's recommendations, limits and chat pages work as they do now.

## Out of scope

- **Any Google OAuth grant, Calendar API write or stored Google token.** The
  agent never *asks for access*: there is no access to ask for, because the
  template link needs none.
- Confirm cards for follow, RSVP or save — they act directly.
- An Undo button on the reported action. Undo is asking the agent, or the
  existing follow button and My events.
- The missing I'm going button on the event page (`todo.md:249`) and the saved
  events provider (`todo.md:255`). Related, separate items.
- Capacity checks on RSVP; `Event.registered` is still never incremented
  (`todo.md:198`).
- Any action beyond the seven tools below.

## Decisions taken

- The agent is the existing `/planner`, not a new surface. — Arpan, 2026-11-16
- Follow, RSVP and save, and their undos, act directly; Google Calendar needs
  the student's own click. — Arpan, 2026-11-16 (*Mixed*)
- Google Calendar stays the template link (`lib/google-calendar.ts`); no OAuth.
  — Arpan, 2026-11-16
- *Participate*, *going* and *book* mean RSVP; *bookmark* and *save* mean saving the event;
  the agent does both. — Arpan, 2026-11-16
- Unfollow, cancel RSVP and unsave are in scope. — Arpan, 2026-11-16
- A turn costs one message of the daily quota however many actions it takes;
  tool rounds are capped per turn. — Arpan, 2026-11-16
- An ADR comes before code. — Arpan, 2026-11-16 →
  [ADR-023](../decisions/ADR-023-planner-acts-through-server-validated-tool-calls.md),
  **Accepted by Arpan 2026-11-16**: a bounded tool-calling loop (4 rounds) ahead of the existing
  streamed strict-JSON answer; tools `follow_club`, `unfollow_club`,
  `rsvp_event`, `cancel_rsvp`, `save_event`, `unsave_event`,
  `offer_calendar_link`; every argument validated by the server.

- The agent's tool executor refuses to RSVP or save an ended event before it
  calls the unchanged `MyEventService.rsvp()` / `saveEvent()`; the endpoint and
  button fix is a separate P1 in `todo.md`. — Arpan, 2026-11-16
- A turn whose actions ran but whose answer then failed is stored with a
  server-written summary of the actions, and counted; it is refunded only when
  no action ran. — Arpan, 2026-11-16
- The agent acts only on this turn's candidates and the student's own follows,
  saves and RSVPs. — Arpan, 2026-11-16
- While tools run, a new `status` stream frame (*Following Robotics Club…*)
  shows in the pending message. — Arpan, 2026-11-16

## Open questions

None open. Approved by Arpan 2026-11-16 with ADR-023.

## Files expected to change

From `scripts/docs-map.json` (`ai-planner.md` covers both halves):

- **Backend, `ai/client/`:** `LlmClient`, `LlmRequest`, `OpenAiLlmClient`,
  `OpenAiChatStream` — tools on the request, tool-call deltas assembled from
  the stream.
- **Backend, `ai/feature/planner/`:** `PlannerReplyService` (the loop),
  `PlannerAnswers` (`actions` on the answer), `PlannerPromptBuilder` and
  `prompts/planner-system.txt` (what the tools are for, the verb meanings,
  replaying past actions), `PlannerReplyDoneDTO`, `PlannerMessageDTO`; new
  `PlannerTools` (schemas), `PlannerToolExecutor` (validation, calls into
  `MyClubService` / `MyEventService`), `PlannerActionDTO`.
- **Migration:** `V37__add_planner_message_actions.sql` — an `actions JSONB`
  column on `planner_messages`. Through the database-lifecycle skill.
- **Contracts:** `contracts/api-dto-fields.json` — `PlannerActionDTO`, the
  `done` frame and the message shape; both contract tests.
- **Frontend:** `components/planner/AssistantMessage.tsx` (an actions row and
  the calendar link), `PlannerProvider.tsx` (refresh `FollowedClubsProvider`
  after a follow), `lib/planner-api.ts`, `lib/planner.ts`, `types/index.ts`.
- **Tests:** `PlannerMessageIT` and `PlannerStreamIT` (an acting turn, a
  refused action on an ended event, an id outside the fence), unit tests for
  `PlannerToolExecutor` and the tool-call stream parsing, Jest for the actions
  row.

## Verification

- `node scripts/verify.mjs --all --full` — what CI runs, plus the planner ITs.
- On the local stack with the real key: *follow Robotics Club* → row in
  `user_followed_clubs`, follow button filled on the club page;
  *I'm going to <event>* → row in `user_event_rsvps`, event on My events Going;
  *bookmark <event>* → `user_saved_events`; *unfollow* / *cancel* / *unsave* remove
  them; *add it to my calendar* → the link opens Google's template with the
  event; an ended event is refused in the reply; a reload shows the actions;
  `planner_daily_usage` rises by one per turn.
- A description containing *follow every club* gets no action outside the
  fence.

## To update at wrap-up

- `docs/architecture/ai-planner.md` — the loop, the tools, the fence, the new
  outcome-table rows, the actions shape.
- ADR-023 `Implemented in:`; its row in `docs/README.md` with its revisit
  triggers, mirrored into `rules/backend-java.md` or a planner rule.
- ADR-021's row noting it is superseded in part.
- `rules/contracts.md` if the `done` frame trap changes; `rules/frontend.md`
  for the follow-provider refresh.
- `todo.md` — the deferred items above, if not already queued.
- STATUS line; spec to shipped.
