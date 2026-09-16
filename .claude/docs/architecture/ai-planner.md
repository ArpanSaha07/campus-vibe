# AI planner — Implementation & Design Decisions

**Status:** 2026-09-16 · branch `feature/ai-planner` · **built end to end and
uncommitted.** The frontend is committed (`2b8cfe4`); the backend is the
uncommitted planner backend unit. Seen working on the local stack against the
real OpenAI key: a streamed events answer, a clubs follow-up, an events
follow-up, a reload, and a prompt-injection attempt declined. Not yet deployed.
**Authors:** main session.
**Code as of:** `95418a1` plus the uncommitted planner backend unit, read
2026-09-16: everything under `backend/src/main/java/com/campusvibe/ai/`, V36,
the planner queries in `SearchRepository`, and the frontend files below, which
the unit did not change. Before that, `70336d2` plus the event end time unit.
**Specs:** [`2026-09-16-planner-chat-ui.md`](../../specs/2026-09-16-planner-chat-ui.md)
(frontend) · [`2026-09-16-planner-backend.md`](../../specs/2026-09-16-planner-backend.md)
(backend).

## In one paragraph

The planner is a chat page in the style of ChatGPT. Saved chats sit in a
sidebar, at most 15 per person, and a person may send 15 messages a day across
all of them, reset at midnight Montreal time. An answer is a short intro, one
row of real event or club cards, one line per card saying why it fits, and a
few follow-up prompts to tap. The server picks at most 15 events that have not
ended and at most 6 clubs, asks OpenAI to choose among only those, streams the
intro as it is written, and throws away any pick it did not offer. A reply that
fails leaves nothing behind and gives the message back; one the person stops
leaves nothing behind and still counts. **Deploy the backend and frontend
together**, with `OPENAI_API_KEY` set: without the key the page shows *The
planner is unavailable*.

## Read this before you change anything here

- **The answer shape is intro plus typed picks**
  ([ADR-019](../decisions/ADR-019-planner-answer-is-intro-plus-typed-picks.md)),
  produced by **one streamed call with a strict JSON schema**
  ([ADR-021](../decisions/ADR-021-planner-streams-its-intro-out-of-strict-json.md),
  Proposed). `intro` must stay the schema's first property
  (`PlannerAnswers.java:42`), or nothing streams.
- **The model is not trusted with ids.** `PlannerAnswers.keep`
  (`PlannerAnswers.java:81`) keeps only picks that were this message's
  candidates. Every retrieval source filters `end_time > now()`
  ([ADR-020](../decisions/ADR-020-event-attendable-until-its-end-time.md)).
  Remove either and an ended or invented event can reach the page.
- **The stream's async dispatch is permitted in security**
  (`SecurityFilterChainConfig.java:60`). Without it the reply breaks off
  mid-stream; only `PlannerStreamIT` catches that, because MockMvc does not
  dispatch the way Tomcat does. [`rules/backend-java.md`](../../rules/backend-java.md).
- **Error handlers the endpoint can reach preset `application/json`**
  (`DefaultExceptionHandler.java:35`, `:306`). The page asks for
  `text/event-stream`, and a negotiated `ApiError` turned the 429 and 503 into a
  bodiless 500. Same rule file.
- **Quota lives in `planner_daily_usage`, not a count of messages**, and is spent
  in one conditional upsert (`PlannerUsageRepository.java:28`). Deleting a chat
  never returns a message.
- **Frontend state lives in `PlannerProvider`, not in the pages**
  (`components/planner/PlannerProvider.tsx:92`). The first message of a new chat
  moves the URL to `/planner/{id}` while the reply is still streaming; the page
  remounts on that move and the layout does not.
- **The streamed reply goes through `apiFetchResponse`** (`lib/api.tsx:154`).
  `EventSource` cannot send the Authorization header.
  [`rules/frontend.md`](../../rules/frontend.md).
- **All eight planner shapes are contracted** in `contracts/api-dto-fields.json`,
  the `done` frame included. [`rules/contracts.md`](../../rules/contracts.md).
- **Prompts are text files** under `backend/src/main/resources/prompts/`, filled
  by `PromptTemplateService`, which fails on a missing or unused value.
- Visual rules: [`design-guidelines.md`](../../design-guidelines.md) plus the
  approved design artifact linked from the frontend spec. The guidelines have no
  chat section yet.

## Overview

**Frontend.** `/planner` is its own route group, `app/(planner)/`, so it can
drop the footer and fill the viewport: navbar, then two panes that scroll
independently. The layout mounts `PlannerProvider` and `PlannerShell`; the two
pages, `planner/page.tsx` for a new chat and `planner/[conversationId]/page.tsx`
for a saved one, each render `PlannerChat` and nothing else. Every planner
response is one user's data, so all of it is fetched in the browser with the
token and none of it is rendered or cached on the server. **The provider owns
the conversation list, the usage count, every loaded thread and the one reply
that may be streaming**, keyed by chat id; a page only chooses which thread to
show and owns its draft.

**Backend.** `com.campusvibe.ai.feature.planner`, layered as the llm-integration
skill asks: `PlannerController` → feature services → `LlmClient` → OpenAI. A
message goes through two phases.

1. **On the request thread** (`PlannerReplyService.start`, `:110`): refuse an
   empty or over-1,000-character message (400), a chat that is not the caller's
   (404), a missing key (503); answer a chat already holding 40 messages with an
   `error` frame, uncounted (`:128`); then spend today's message, or 429
   (`:134`). Only now does a stream exist.
2. **On a virtual thread** (`reply`, `:149`): read the last 10 messages,
   retrieve candidates, build the prompt, stream the model's JSON through
   `IntroStreamReader` as `delta` frames, parse and validate the answer, store
   both messages in one transaction, and send `done` with freshly hydrated
   cards.

An assistant message arrives in two parts. `delta` frames carry the intro text
as it is written; a single `done` frame carries the picks, the hydrated
`EventDTO` / `ClubDTO` rows they point at, the new usage and the chat's summary.
The card row, the per-pick lines and the follow-ups render only from `done`.

**What happens to a message:**

| Outcome | Stored | Counted | Frame |
|---|---|---|---|
| Completes | both messages; title set if unset; `last_active_at` moved | yes | `done` |
| Provider error, timeout, truncated or unparseable answer | nothing | refunded | `error` `AI_PROVIDER_ERROR` |
| Model refuses | nothing | refunded | `error`, *try asking another way* |
| Client stops or disconnects | nothing | **yes**, the call was paid for | none |
| Stream timeout (3 min) | nothing | refunded | none |
| Chat deleted while replying | nothing | refunded | `error` `CONVERSATION_GONE` |
| Chat already at 40 messages | nothing | never spent | `error` `CONVERSATION_FULL` |

## Backend: file-by-file breakdown

### `db/migrations/V36__create_planner_tables.sql`

`planner_conversations` (UUID id, nullable title, `last_active_at`),
`planner_messages` (role check, `picks JSONB`), `planner_daily_usage`
(`PK (user_id, usage_date)`). Every table cascades from `users`. No status
column on messages: a failed reply is never stored, so every stored message is
`complete`.

### `PlannerController.java`

The six routes. The message route returns `ResponseEntity<SseEmitter>` so it
can set `X-Accel-Buffering: no` (`:88`), which stops nginx on Elastic Beanstalk
buffering the stream. The user comes from the JWT principal, never the path.
A signed-out caller gets 403, as every other signed-in route here does.

### `PlannerConversationService.java`

- `create` (`:75`) locks the user's row (`SELECT … FOR UPDATE`), deletes least
  recently active chats while 15 exist, then inserts. Tested with eight
  simultaneous creates.
- `get` reads every message and hydrates all their picks in one pass through
  `cardsFor` (`:164`), which drops events that have ended (`:177`) or been
  deleted.
- `recordExchange` (`:127`) is the only write a reply makes: set the title if
  unset, move `last_active_at`, insert both messages. Empty when the chat was
  deleted mid-reply.
- `titleFrom` (`:141`) cuts at 60 code points, never mid-character.
- A malformed chat id is a 404 (`:194`), because the page treats both the same.

### `PlannerUsageService.java` · `PlannerUsageRepository.java` · `PlannerDay.java`

The day is `America/Toronto`'s. `spend` returns the day it counted against, so a
refund after midnight hands back the right day's message. `trySpend` is one
`INSERT … ON CONFLICT DO UPDATE … WHERE message_count < 15`, so two sends at 14
cannot both pass. 429 carries `Retry-After` through the existing
`TooManyAttemptsException` handler.

### `PlannerRetrievalService.java` · `PlannerCandidateRepository.java` · `SearchRepository` (planner part)

`retrieve` (`:96`) pools up to 30 ids from each source, all windowed to
`end_time > now()` and a start within 30 days:

- hybrid search on the prompt plus the previous prompt, one embedding through
  `QueryEmbeddingCache` (`:102`), keyword-only when it returns nothing;
- saved and going events; events of followed clubs;
- the previous answer's items: after clubs, their events; after events, their
  organizers (`:141`);
- the soonest-starting events (`:122`), the only source that can answer *what's
  on now?*, which names nothing search could match.

The search leg (`SearchRepository.java:183`, `:215`) matches **any** word of the
prompt (`ANY_WORD_QUERY`, `:172`), rewriting the `&` of Postgres's own
`plainto_tsquery` output to `|`. The search box's all-words query matches
nothing for a sentence. The vector is bound as a typed null when absent.

### `PlannerRanker.java`

Pure scoring, unit-tested. Weights (`:25`–`:37`): previous-answer context 0.35,
saved or going 0.25, followed organizer 0.15, shared interest 0.10, running now
when the prompt says now or tonight 0.30, soonest up to 0.05, plus the hybrid
search score. Hand-set, not measured. Ranks decide what the model is *shown*.

### `PlannerPromptBuilder.java` · `prompts/planner-system.txt` · `ai/prompt/PromptTemplateService.java`

One line per candidate with catalogue labels, Montreal times formatted with
`Locale.US` (BUG-001, BUG-058), and a *running now* marker. Descriptions are cut
to 200 characters and flattened to one line. The student's text is wrapped in
`<message>` tags that it cannot close (`wrap`). Earlier answers are replayed as
their intro plus a *Recommended:* list of kind, id and name. Taxonomy labels
are read with `findAll()` on every message (`:78`), uncached.

### `PlannerAnswers.java` · `IntroStreamReader.java`

`schema()` is strict: `intro`, `kind` (`event`, `club`, `none`), `picks[{id,
reason}]`. `keep` drops unoffered, other-kind, repeated and reasonless picks,
cuts reasons at 300 characters, and keeps at most 6. `IntroStreamReader`
decodes the intro string out of partial JSON: it holds an incomplete escape,
never hands out a lone high surrogate (`:54`), and gives up quietly if the
answer does not open with its intro property (`:26`); `reply` then sends whatever of
the parsed intro was not streamed (`PlannerReplyService.java:189`).

### `PlannerReplyService.java` · `PlannerReplySink.java` · `SseReplySink.java`

The sink interface exists so a test can play a client that leaves. `SseReplySink`
synchronises every write (`:89`), because the keep-alive scheduler (a comment
every 15 s, `PlannerReplyService.java:70`, under the ALB's 60 s idle timeout)
writes too, and marks itself gone on a failed write, a container error or a
timeout (`:27`). A gone sink throws from `delta`, which aborts the provider
stream. The emitter's own timeout is 3 minutes (`:67`), set explicitly because
Tomcat's default async timeout is 30 seconds. One log line per answer records
counts only: kind, picked, kept, candidates (`:182`).

### `ai/client/` — `LlmClient`, `OpenAiLlmClient`, `OpenAiChatStream`, `LlmRequest`, `LlmException`

`streamStructured` (`OpenAiLlmClient.java:82`) posts Chat Completions with
`stream: true`, `stream_options.include_usage` and a `json_schema` response
format (`:180`). Retries 429, 5xx and network failures **only before the first
fragment** (`:116`, `:130`). A watchdog closes a stream that outlives
`chatTimeout` (`:146`), because the JDK client's read timeout only covers the
headers. `OpenAiChatStream` turns `finish_reason: length` into `TRUNCATED`, a
refusal or content filter into `REFUSED`, and a stream without `[DONE]` into
`FAILED`; a provider error object is reduced to its type, since its message can
quote the prompt.

### Configuration

`OpenAiProperties` gained `chatModel` (`gpt-4.1-mini`), `maxOutputTokens`
(1200) and `chatTimeout` (60 s), exposed as `OPENAI_CHAT_MODEL`,
`OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_CHAT_TIMEOUT` in `application.yml`, compose,
`.env.example` and `docker/EB-DEPLOYMENT.md`.

## Frontend: file-by-file breakdown

Unchanged by the backend unit; line numbers read at `70336d2`.

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
  (`:110-135`).
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
- `retry` removes the failed pair and resends the same text. The server stored
  nothing for the failure, so the chat never holds the question twice.
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

### `frontend/app/components/planner/PlannerEmptyState.tsx`

Greeting, the eviction notice when 15 chats are saved naming the one that will
go, the message box, the provider's error or the sign-in notice, and the four
starter chips, which fill the box rather than send.

### `frontend/app/lib/planner-api.ts`

The six endpoint calls, and the stream reader. `createSseParser` (`:113`) holds
text until a blank line closes a frame, normalises CRLF, skips `:` comments
(the server's keep-alives) and joins multi-line `data`. `sendPlannerMessage`
(`:157`) rejects with `ApiError` when the request is refused,
`PlannerReplyError` on an `error` frame (`:198`), whose message the page shows
as written, and `INCOMPLETE_STREAM` when the body ends without `done` (`:200`).
`getConversation` maps a 404 to null, because another user's chat is a 404 too.

### `frontend/app/lib/planner.ts`

What needs no server: the prompt stash key, the 15-chat cap, the 1,000
character limit, the starter and follow-up chip lists, day grouping, the chat
an eviction would remove (`:63`), a provisional title, and the row label using
`formatEventDateRange` from `lib/event-zone.ts` (`:79`).

### `frontend/app/lib/adapters.ts` (planner part)

`toPlannerPicks` (`:205`) joins picks to the hydrated rows, **drops a pick with
no row** (deleted or ended since), and keeps only the first pick's kind
(`:215`), so no answer can render two rows even if a reply mixes them.

### `frontend/app/types/index.ts` (planner part)

`Api*` shapes mirroring the `Planner*DTO` records, and the adapted `Planner*`
view types, from `:80`. `PlannerMessage.status` adds `streaming` and `stopped`,
which exist only in the browser.

### Outside the folder

- `components/Navbar.tsx:21,129` hides the second-row search on `/planner`
  below `sm`.
- `components/main-page/PlannerCardMainPage.tsx` shares its chips with the
  empty state through `PLANNER_SUGGESTIONS` and still routes to
  `/planner?prompt=`.

### Tests

- **Backend unit:** `IntroStreamReaderTest`, `PlannerAnswersTest`,
  `PlannerRankerTest`, `PlannerDayTest` (including the 25-hour day),
  `PlannerPromptBuilderTest` (under a `fr_CA` format locale),
  `OpenAiChatStreamTest`, and `ApiContractTest`.
- **Backend ITs**, with `ScriptedLlmClient` in place of OpenAI:
  `PlannerConversationIT` (create, list, read, delete, eviction, simultaneous
  creates, 404 for another user's chat, 403 signed out), `PlannerMessageIT`
  (frames and storage, dropped picks, an event ending after the answer, the
  follow-up history, 429 and delete-does-not-refund, failure refund, unparseable
  answer, a client that stops, a full chat, the 400/404/503 refusals), and
  `PlannerStreamIT` on a real port (async security, headers, refusals asked for
  as a stream).
- **Frontend:** `planner-api.test.ts`, `AssistantMessage.test.tsx`,
  `ConversationSidebar.test.tsx`, `PlannerComposer.test.tsx`,
  `PlannerEmptyState.test.tsx`, `PlannerChat.test.tsx`, and the contract test.

## Design decisions

### General

| Decision | Forced by | Rejected | If reverted |
|---|---|---|---|
| Intro plus typed picks ([ADR-019](../decisions/ADR-019-planner-answer-is-intro-plus-typed-picks.md)) | The design puts the intro above the row and a line per pick below it | Inline `[[event:id]]` markers | Cards land wherever the model put a marker; the per-pick lines have nowhere to come from |
| One streamed call with a strict JSON schema, intro read out as it arrives ([ADR-021](../decisions/ADR-021-planner-streams-its-intro-out-of-strict-json.md), Proposed) | ADR-019 needs structured picks after a streamed intro | Two calls; plain text then a delimited JSON block | Double cost and an intro that can disagree with its picks, or an unenforced format |
| A failed reply stores nothing and is refunded; a stopped one stores nothing and counts (Arpan, 2026-09-16) | The page's Try again resends the text; a stop still paid the provider | Storing failed pairs | Every retried question appears twice on reload |
| Quota in its own table (plan, Arpan, 2026-09-15) | Deleting or evicting a chat must not return messages | Counting stored messages | Deleting a chat buys more messages |
| Picks as a JSONB column (Arpan, 2026-09-16) | Always read with the message; an event id and a slug cannot share a foreign key | A child table | — |
| Real endpoints only, no mock layer (Arpan, 2026-09-16) | A mock is code thrown away | A fake client | — |
| State in a layout-level provider | The first message changes the URL mid-stream | State in `PlannerChat` | The stream is dropped on every new chat |
| Chips chosen by answer kind in the frontend (Arpan, 2026-09-16) | Predictable and free | Model-suggested follow-ups | — |

### Task-specific

- **Plain SQL, not JPA, for the planner tables.** The writes that matter are a
  row lock, a conditional upsert and an update-returning, and the H2 context the
  fast tests boot would not accept a `jsonb` column mapping. No entity also means
  no flush to forget between JPA and JdbcTemplate (BUG-034).
- **Refusals happen before the stream**, so the page sees a plain status. The
  one exception is the full chat, which the spec put in the stream so its
  message shows as written.
- **The 40-message check counts before spending, not after.** The spec said
  refund; never spending is the same to the user and cannot fail half way. It is
  not locked, so two sends racing into one chat at 38 can store 42.
- **Soonest-starting events are a retrieval source**, which the spec did not
  list. Without it *what's on right now?* has no candidates when nothing matches
  its words.
- **Reasons are shown to the student but written from club-authored text.** The
  ids are validated; the wording is not. The prompt says candidate text is data.
- **`apiFetchResponse` rather than a bare `fetch`** on the frontend shares the
  auth header and `ApiError` with `apiFetch`, so 429 and 503 reach the caller
  before any body is read.
- **Usage is counted optimistically in the browser, then replaced** by the
  `done` frame's usage; a failure re-reads it, since the refund is the server's.
- **The eviction warning is computed in the browser** from the list it holds.
  Both sides use least recently active, then oldest.

## Known deviations, gaps and blockers

- **Not deployed.** Production needs `OPENAI_API_KEY` on Elastic Beanstalk (it is
  blank there), and the backend and frontend must ship together. V35 and V36
  apply on start.
- **Behind the real load balancer and nginx: untested.** `X-Accel-Buffering` and
  the 15-second keep-alive are there for them and were only exercised locally,
  where there is no proxy.
- **The first live answer's intro said *a couple of workshops* over one card.**
  Whether the model named a second event that validation dropped is unknown: the
  pick-count log line was added after that reply.
- **Ranker weights are guesses.** No evaluation set exists.
- **Retrieval costs about a dozen queries per message**, plus the element
  collections `EventMapper` loads per candidate event and three uncached
  taxonomy `findAll()` calls in the prompt builder.
- **A `done` frame that fails to send after the store** leaves a stored reply
  the client never saw; it appears on reload.
- **Not seen in a browser:** a 390px viewport, the 15-of-15 notice, a 429, the
  homepage card hand-off, a provider failure. Jest and the ITs cover each.
- **Scroll-to-end runs on every delta,** so reading an earlier answer while one
  streams pulls the view down.
- **The delete icon is hover-only on other chats,** so on a touch screen a chat
  can be deleted only once opened.

## Possible improvements

1. **Deploy, then run the browser checks above against production** — the only
   way to see the proxy behaviour.
2. **A small evaluation set of prompts** with expected picks, before touching
   the ranker weights or the prompt.
3. **Cache the taxonomy labels** — when a profile shows retrieval or prompt
   building in the reply's latency.
4. **A chat surfaces section in `design-guidelines.md`** — waiting on Arpan's
   wording.
5. **Stop auto-scrolling when the reader has scrolled up.**

## Change log

- 2026-09-16 — main session: the backend half, for the planner backend unit;
  the frontend sections re-read and their stale gaps (no backend, no contract,
  duplicated retries, the UTC badge) removed.
- 2026-09-16 — main session: planner dates formatted in Montreal time through
  `lib/event-zone.ts`, with the event end time unit.
- 2026-09-16 — main session: replaced the pre-code guide with this document
  for the frontend built in the planner chat UI unit.
