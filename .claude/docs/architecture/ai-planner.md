# AI planner — Implementation & Design Decisions

**Status:** 2026-09-16 · branch `feature/ai-planner` · **the frontend is built;
the backend it calls does not exist.** Every signed-in visit to `/planner`
renders *The planner is unavailable* until the planner endpoints ship (Unit 2 of
the AI planner plan). A populated thread has been seen only in Jest and in a
browser with `fetch` stubbed in the tab.
**Authors:** main session.
**Code as of:** `b0c5e63` plus the uncommitted planner chat UI unit, read
2026-09-16.
**Spec:** [`2026-09-16-planner-chat-ui.md`](../../specs/2026-09-16-planner-chat-ui.md).
Replaces the pre-code guide that lived at this path, which described a
single-page plan layout that was never the design.

## In one paragraph

The planner is a chat page in the style of ChatGPT. Saved chats sit in a
sidebar, at most 15 per person, and a person may send 15 messages a day across
all of them. An answer is a short intro, one row of real event or club cards,
one line per card saying why it fits, and a few follow-up prompts to tap. The
page is finished and tested, but it talks to server endpoints that have not
been written yet, so today it shows an unavailable message to anyone signed in.
**Deploying this branch before the backend lands replaces the old sample
planner with that message.**

## Read this before you change anything here

- **State lives in `PlannerProvider`, not in the pages**
  (`components/planner/PlannerProvider.tsx:92`). The first message of a new
  chat moves the URL to `/planner/{id}` while the reply is still streaming; the
  page remounts on that move and the layout does not.
- **The answer shape is intro plus typed picks**, decided by Arpan on
  2026-09-16 ([ADR-017](../decisions/ADR-017-planner-answer-is-intro-plus-typed-picks.md),
  Proposed). The backend must produce exactly this; the markers in the plan are
  withdrawn.
- **The streamed reply goes through `apiFetchResponse`** (`lib/api.tsx:154`),
  the `apiFetch` sibling that hands back the unread body. `EventSource` cannot
  send the Authorization header. [`rules/frontend.md`](../../rules/frontend.md).
- **The planner DTOs are not in `contracts/api-dto-fields.json`.** No Java class
  exists to assert against, so a rename on either side passes both suites
  until Unit 2 adds them. [`rules/contracts.md`](../../rules/contracts.md).
- Visual rules: [`design-guidelines.md`](../../design-guidelines.md) plus the
  approved design artifact linked from the spec. The guidelines have no chat
  section yet.

## Overview

`/planner` is its own route group, `app/(planner)/`, so it can drop the footer
and fill the viewport: navbar, then two panes that scroll independently. The
layout mounts `PlannerProvider` and `PlannerShell`; the two pages,
`planner/page.tsx` for a new chat and `planner/[conversationId]/page.tsx` for a
saved one, each render `PlannerChat` and nothing else. Every planner response
is one user's data, so all of it is fetched in the browser with the token and
none of it is rendered or cached on the server.

The one idea to hold: **the provider owns the conversation list, the usage
count, every loaded thread and the one reply that may be streaming**, keyed by
chat id. A page only chooses which thread to show and owns the draft in its
message box. That split is what lets a new chat's first reply keep streaming
through the URL change.

An assistant message arrives in two parts. `delta` frames carry the intro text
as it is written; a single `done` frame carries the picks, the hydrated
`EventDTO` / `ClubDTO` rows they point at, the new usage and the chat's summary.
The card row, the per-pick lines and the follow-ups render only from `done`.

## File-by-file breakdown

### `frontend/app/(planner)/layout.tsx`

Navbar, provider, shell, in a `h-dvh` column with `overflow-hidden`. No footer.
A route group rather than a branch inside `(main)/layout.tsx`, because the main
layout is `min-h-screen` with a footer and the planner must not scroll as a
page.

### `frontend/app/(planner)/planner/page.tsx`

A new chat. Reads `?prompt=` (sent by the homepage card) and passes it on as
`initialPrompt`. Dynamic because it reads `searchParams`.

### `frontend/app/(planner)/planner/[conversationId]/page.tsx`

A saved chat. Keys `PlannerChat` by the id so moving between chats resets the
draft.

### `frontend/app/components/planner/PlannerProvider.tsx`

- Status machine: `loading` while auth resolves or the list loads, `guest`,
  `ready`, or `unavailable` when `listConversations` fails for any reason
  (`:110-135`). A 404 from a backend without the endpoints lands here.
- `send` (`:229`): creates the chat first when there is no id, adopts its
  summary, drops an evicted chat, then `router.replace`s to its URL (`:255`)
  and starts `streamReply`. Returns false, and sets `newChatError`, when the
  create fails, so the page can put the text back.
- `streamReply` (`:178`): appends the user message and an empty `streaming`
  reply with local ids, bumps the chat to the top, counts the message
  optimistically, then applies each delta. On `done` it swaps in the server id
  and picks and takes the server's usage. On failure the reply becomes `failed`
  with a sentence from `plannerErrorMessage`, or `stopped` on abort, and usage
  is re-read (`:218`) because the server refunds a failed message.
- One reply at a time: `abortRef` is the lock (`:232`, `:269`).
- `retry` removes the failed pair and resends the same text.
- `remove` deletes, then leaves the chat's URL if it was open (`:293`).

### `frontend/app/components/planner/PlannerShell.tsx`

Two panes. The sidebar is fixed at 280px from `lg` (`:57`); below it a slim bar
with a panel icon, the chat title and a New chat icon (`:64`) opens the same
sidebar as a drawer (`:92`). The drawer closes on navigation (`:29`), on Escape
and on the scrim. Nothing renders in the side pane unless status is `ready`.

### `frontend/app/components/planner/ConversationSidebar.tsx`

Props only, no context, so it is testable in isolation. Groups chats by the
viewer's local day into Today, Previous 7 days and Older; the delete icon is
always visible on the open chat and on hover or focus elsewhere (`:135`).
Delete turns the row into an inline confirm and keeps it open with a message if
the delete fails. The foot is the usage meter, a `role="meter"` bar (`:154`),
and the saved-chat count, which turns berry at 15.

### `frontend/app/components/planner/PlannerChat.tsx`

Chooses the view: loading, unavailable with Try again, sign-in for a guest on a
chat URL, the new-chat empty state, a chat that is gone or failed to load, or
the thread with the message box pinned under it.

- A guest who sends keeps the text in `sessionStorage` under
  `PLANNER_PROMPT_KEY` and sees a sign-in notice (`:75`); the notice is gated on
  status as well, because signing in from the modal leaves the page mounted
  (`:141`).
- A stashed prompt is put back in the box on mount and **not sent** (`:47`),
  since sending spends one of the day's messages.
- The homepage prompt **is** sent once when the planner is ready (`:53`),
  guarded by a ref against React's double effect in development.
- Scrolls to the end when a message is added or the last one grows (`:68`).

### `frontend/app/components/planner/AssistantMessage.tsx`

Intro, then `ticket-label` count and date range, one `CardRow` of `EventCard`
or `ClubCard`, a line per pick with a mono weekday for events, a failure line
with Try again, and the follow-up chips for the answer's kind (`:103`). Chips
appear only once a reply is `complete` and has picks.

### `frontend/app/components/planner/CardRow.tsx`

A `role="list"` flex row that never wraps and scrolls sideways on the
`.card-row` scrollbar (`globals.css:118`). `pt-1` leaves room for a card's
2px hover lift, which the scroll container would otherwise clip. On phones it
bleeds to the screen edge so the next card peeks.

### `frontend/app/components/planner/PlannerComposer.tsx`

Autosizing textarea, capped at 200px, refitted on resize because its padding
changes at `sm` (`:51`). Enter sends, Shift+Enter is a newline, and an Enter
that confirms an IME candidate is ignored (`:66`). The send button becomes stop
while its chat streams; `sendDisabled` blocks sending while another chat does.
At zero messages left the box is disabled with the reason as its placeholder.
One line with the button beside it on phones, a taller box above `sm`.

### `frontend/app/components/planner/PlannerEmptyState.tsx`

Greeting, the eviction notice when 15 chats are saved naming the one that will
go, the message box, the provider's error or the sign-in notice, and the four
starter chips, which fill the box rather than send.

### `frontend/app/lib/planner-api.ts`

The six endpoint calls, and the stream reader. `createSseParser` (`:113`) holds
text until a blank line closes a frame, normalises CRLF, skips `:` comments and
joins multi-line `data`. `sendPlannerMessage` (`:157`) rejects with `ApiError`
when the request is refused, `PlannerReplyError` on an `error` frame (`:198`),
and `INCOMPLETE_STREAM` when the body ends without `done` (`:200`).
`getConversation` maps a 404 to null, because another user's chat is a 404 too.

### `frontend/app/lib/planner.ts`

What needs no server: the prompt stash key, the 15-chat cap, the 1,000
character limit, the starter and follow-up chip lists, day grouping, the chat
an eviction would remove (`:63`), a provisional title, and the row label using
`Intl.DateTimeFormat.formatRange` (`:79`).

### `frontend/app/lib/adapters.ts` (planner part)

`toPlannerPicks` (`:205`) joins picks to the hydrated rows, **drops a pick with
no row** (deleted or ended since), and keeps only the first pick's kind
(`:215`), so no answer can render two rows even if a reply mixes them.

### `frontend/app/types/index.ts` (planner part)

`Api*` shapes for the planned responses and the adapted `Planner*` view types,
from `:80`. `PlannerMessage.status` adds `streaming` and `stopped`, which exist
only in the browser.

### Outside the folder

- `components/Navbar.tsx:21,129` hides the second-row search on `/planner`
  below `sm`, where it would take a fifth of the screen from the conversation.
- `components/main-page/PlannerCardMainPage.tsx` shares its chips with the
  empty state through `PLANNER_SUGGESTIONS` and still routes to
  `/planner?prompt=`.
- Tests: `planner-api.test.ts`, `AssistantMessage.test.tsx`,
  `ConversationSidebar.test.tsx`, `PlannerComposer.test.tsx`,
  `PlannerEmptyState.test.tsx`, `PlannerChat.test.tsx` — 35 tests.

## Design decisions

### General

| Decision | Forced by | Rejected | If reverted |
|---|---|---|---|
| Intro plus typed picks, not prose with inline `[[event:id]]` markers ([ADR-017](../decisions/ADR-017-planner-answer-is-intro-plus-typed-picks.md)) | The design puts the intro above the row and a line per pick below it | Markers: the layout would depend on the model writing paragraphs in the right order | Cards land wherever the model put a marker; the per-pick lines have nowhere to come from |
| Real endpoints only, no mock layer (Arpan, 2026-09-16) | A mock is code thrown away in Unit 2 | A fake client from sample events, in memory or `localStorage` | — |
| State in a layout-level provider | The first message changes the URL mid-stream | State in `PlannerChat` | The stream is dropped, or the thread refetched half-written, on every new chat |
| One reply streams at a time | The daily quota and retry both reason about one pending message | Per-chat streams | Two replies race the usage count |
| Chips chosen by answer kind in the frontend (Arpan, 2026-09-16) | Predictable and free | Model-suggested follow-ups | — |
| Inline delete confirm (Arpan, 2026-09-16) | Stays in the site's styling and works in the drawer | `window.confirm` | — |

### Task-specific

- **`apiFetchResponse` rather than a bare `fetch`.** Shares `requestHeaders`
  and `throwIfNotOk` with `apiFetch` (`api.tsx:81`, `:98`), so the auth header
  and `ApiError` stay single-sourced and the refusal statuses (429, 503) reach
  the caller before any body is read. Takes no cache options at all.
- **Usage is counted optimistically, then replaced.** The meter moves on send,
  the `done` frame's usage overwrites it, and a failure re-reads it rather than
  decrementing, since the refund is the server's to make.
- **A stashed guest prompt is restored, not sent; a homepage prompt is sent.**
  A stash is text the person had not confirmed as a message after signing in;
  the homepage card is an explicit submit.
- **The eviction warning is computed in the browser** from the list the page
  already holds. The server evicts on create regardless; the notice only has
  to name the same chat, and both use least recently active.

## Known deviations, gaps and blockers

- **Nothing works for a signed-in user until the backend ships.** The route
  previously showed a sample plan to everyone.
- **The `done` frame carries `conversation`,** the chat summary, which the spec
  did not list. Unit 2 must send it or the sidebar title stays provisional.
- **Try again resends the text,** so a backend that stored the failed user
  message will hold it twice.
- **Contract coverage is absent** for the planner DTOs (above).
- **Not seen in a browser:** a 390px viewport (the narrowest checked was
  558px), a clubs answer, the 15-of-15 notice, a 429 and the homepage card
  hand-off. Jest covers each; the eye has not.
- **`EventCard`'s Happening now badge is still a UTC today check**
  (`EventCard.tsx:17-18`), wrong for a planner that promises ongoing events.
  Unit 1 fixes it ([spec](../../specs/2026-09-15-event-end-time.md)).
- **Scroll-to-end runs on every delta,** so reading an earlier answer while one
  streams pulls the view down.
- **The delete icon is hover-only on other chats,** so on a touch screen a chat
  can be deleted only once opened.

## Possible improvements

1. **Unit 2, the planner backend** — blocked on its own spec. It unblocks
   everything else here.
2. **Contract entries for the eight planner DTOs** — in the same unit, both
   tests.
3. **A chat surfaces section in `design-guidelines.md`** — sidebar tint, user
   bubble, card row, message box. Waiting on Arpan's wording.
4. **Stop auto-scrolling when the reader has scrolled up** — when the first
   long answer makes it annoying.

## Change log

- 2026-09-16 — main session: replaced the pre-code guide with this document
  for the frontend built in the planner chat UI unit.
