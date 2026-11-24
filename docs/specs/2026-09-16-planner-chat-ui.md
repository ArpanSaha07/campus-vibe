# Planner chat UI

**Status:** shipped · **Date:** 2026-09-16

## Goal

`/planner` becomes the ChatGPT-style page from the approved design artifact
(https://claude.ai/artifact/Y8Tyc5S2LJB2vYzeyaAvPE), built against the planner API as
planned in Unit 2 of the AI planner plan. It has:

- a sidebar of saved chats with New chat, delete and a usage meter
- a thread in which each answer is intro text, one card row, one line per pick and follow-up chips
- a composer pinned to the bottom

The hard-coded mock plan is gone. The page renders its unavailable state until the backend ships,
because the endpoints do not exist yet. This is Unit 3 of the plan, built before Unit 1 (event
end time) and Unit 2 (planner backend) at Arpan's request.

## Out of scope

- **Any backend code.** That includes the planner endpoints, the LLM client, retrieval, V35 and V36.
  These are Units 1 and 2, each with its own spec.
- **Contract entries for the planner DTOs.** `ApiContractTest` checks Java classes that do not exist
  yet. The TypeScript types are written now, and both contract entries are added in Unit 2.
- **Real Happening now and Ended badges.** `EventCard` keeps its current today check
  (`EventCard.tsx:17-18`) until Unit 1 adds `endTime`.
- **Renaming or pinning chats, search in the sidebar, sharing a chat.**
- **A mock or fake data layer.** Arpan chose real endpoints only.
- **Mixing events and clubs in one answer.** An answer has one card row at most.

## Decisions taken

- **Build order.** The UI goes first, before the end time and backend units. Arpan, 2026-09-16.
- **Design.** The design artifact is approved as published (Version 3). Arpan, 2026-09-16. That
  approval settles three choices:
  - the sidebar is tinted `mist-100`
  - the suggestion chips carry a sparkle icon
  - the navbar's second-row search is hidden on `/planner` on phones
- **Card row.** Each answer shows **at most one card row**, of events or of clubs. A row wider than
  the thread scrolls sideways with a thin (6px) `lavender-300` scrollbar. Arpan, 2026-09-16.
- **Data source.** The components call the planned endpoints directly, with no mock. Until Unit 2
  lands, the page renders its unavailable state, and behaviour is proven by Jest with `fetch`
  mocked. Arpan, 2026-09-16.
- **Answer shape.** An assistant message is `intro` text plus `picks: [{kind, id, reason}]`, all of
  one kind.
  - The UI draws the card row from the picks, and a line under the row for each pick from its
    `reason`.
  - The day label on each line comes from the hydrated event.
  - The stream carries the intro as `delta` frames. The picks and the hydrated `events` / `clubs`
    arrive in `done`.
  - Arpan, 2026-09-16. This **replaces** the inline `[[event:id]]` markers in the plan, and Unit 2
    and its ADR follow this shape.
- **Follow-up chips.** The frontend chooses them by answer kind:
  - events: Show related clubs to follow · Something this weekend · During the week
  - clubs: Upcoming events from these clubs · Clubs like these

  Tapping a chip sends it as the next message. Arpan, 2026-09-16.
- **Deleting a chat.** Clicking the trash icon turns the sidebar row into an inline confirm (Delete
  this chat? with Delete and Cancel). No `window.confirm`. Arpan, 2026-09-16.
- **Carried over from the approved plan** (Arpan, 2026-09-15):
  - Routes are `/planner` (new chat) and `/planner/[conversationId]`.
  - The planner has its own layout with the navbar and no footer.
  - At most 15 chats. From 15 of 15, New chat shows a warning naming the chat that will be deleted,
    and the deletion happens when the first message is sent.
  - 15 messages a day across all chats, reset at midnight Toronto time, shown in the meter and
    under the composer.
  - The homepage card opens `/planner` and sends its prompt as the first message; the guest prompt
    stash still works.
  - `PlannerClient`, `PlanTimeline`, `PlannerLoadingState`, the mock in `lib/planner.ts` and the
    `Plan` / `PlanSlot` types are deleted, not restyled.
- **Streaming goes through the `apiFetch` boundary** (`rules/frontend.md`). `lib/api.tsx` gains a
  sibling that shares its auth header and `ApiError` handling but returns the raw `Response`, and
  `lib/planner-api.ts` reads the SSE body from it. `EventSource` cannot send `Authorization`.

## Open questions

- **Is a message refunded when the provider fails?** Yes.
- **Unit 1 spec** (`2026-09-15-event-end-time.md`) is still a draft. Its badges change `EventCard`,
  which this unit reuses unchanged.

## Files expected to change

- **Routes**
  - `frontend/app/(main)/planner/` is removed.
  - New planner route group: `layout.tsx` (Navbar, no Footer), `planner/page.tsx`,
    `planner/[conversationId]/page.tsx`.
- **Components** in `frontend/app/components/planner/`, rebuilt:
  - `PlannerShell`, `ConversationSidebar` (groups, inline delete, usage meter, mobile drawer)
  - `PlannerThread`, `AssistantMessage` (intro, card row, pick lines, chips), `UserMessage`
  - `CardRow` (the thin-scrollbar row)
  - `PlannerComposer` (autosizing, Enter to send, stop while streaming, disabled at 0 left)
  - `PlannerEmptyState` (greeting, eviction notice, suggestions)
  - `PlannerPromptInput.tsx` is kept only if the composer reuses it.
- **Reused unchanged:** `components/event/EventCard.tsx`, `components/club/ClubCard.tsx`,
  `components/ui/Chip.tsx`, `components/ui/Button.tsx`.
- **Libraries and types**
  - `frontend/app/lib/api.tsx`: the raw-`Response` sibling
  - new `frontend/app/lib/planner-api.ts`: endpoint calls and the SSE frame parser
  - `frontend/app/lib/planner.ts`: keeps only `PLANNER_PROMPT_KEY` and the chip lists
  - `frontend/app/types/index.ts`: the planner DTO and view types replace `Plan` / `PlanSlot`
- **Other edits**
  - `frontend/app/components/main-page/PlannerCardMainPage.tsx`: routes to a new chat with the prompt
  - `frontend/app/components/Navbar.tsx`: the second-row search hidden on `/planner` on phones
  - `frontend/app/globals.css`: the `.card-row` scrollbar, if no Tailwind utility covers
    `::-webkit-scrollbar`
- **Tests** in `frontend/app/__tests__/`:
  - `planner-api.test.ts`: the frame parser, including a frame split across chunks, `error`
    frames, 429 and 503
  - `AssistantMessage.test.tsx`: one events row or one clubs row, a line per pick, chips by kind, a
    pick whose card was not hydrated is dropped
  - `ConversationSidebar.test.tsx`: grouping, inline delete confirm, meter text
  - `PlannerComposer.test.tsx`: disabled at 0 left, Enter sends, Shift+Enter adds a newline
  - `PlannerEmptyState.test.tsx`: eviction notice only at 15 of 15
- **Mapped docs** (`scripts/docs-map.json`, `ai-planner.md`): `docs/architecture/ai-planner.md`.
  Its paths change to the new route group.

## Verification

- `cd frontend && npm run verify`: lint, type-check, Jest and a production build with the backend down.
- `node scripts/verify.mjs`, which runs what CI runs.
- A browser check at 1440px and 390px with the local stack (`browser-automation` skill):
  - guest sees the sign-in state, and the prompt is kept through sign-in
  - signed in, the page renders the unavailable state with no console errors, since the endpoints
    are missing
  - mobile drawer opens and closes
  - the homepage card lands on `/planner`

  A populated thread cannot be seen in the browser until Unit 2. Jest covers it.

## To update at wrap-up

- **`docs/architecture/ai-planner.md`:** replace the pre-code guide with the frontend half: answer
  shape, streaming frames, states. Add its row to `docs/README.md`, which closes `todo.md:412`.
- **`scripts/docs-map.json`:** the planner paths move to the new route group.
- **`design-guidelines.md`:** propose a chat surfaces section covering sidebar tint, user bubble,
  assistant prose, card row scrollbar and composer. Arpan approves the wording.
- **Proposed ADR:** an answer is intro plus typed picks rather than prose with inline markers. It
  supersedes item (c) of the plan's ADR list.
- **Plan file:** Unit 2's grounded output and SSE `done` payload follow the answer shape above.
- **`STATUS.md`:** a shipped line noting the page waits on Unit 2.
