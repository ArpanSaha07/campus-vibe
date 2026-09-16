# Planner backend

**Status:** shipped · **Date:** 2026-09-16

## Goal

The `/planner` page built in `2b8cfe4` works end to end for a signed-in user. The six endpoints
in `frontend/app/lib/planner-api.ts` exist, and they:

- keep at most 15 chats per user, evicting the least recently active
- spend one of 15 daily messages per send, resetting at midnight America/Toronto
- stream an answer grounded only in events that have not ended ([ADR-020](../docs/decisions/ADR-020-event-attendable-until-its-end-time.md)) and in real clubs
- return the answer as an intro plus typed picks ([ADR-019](../docs/decisions/ADR-019-planner-answer-is-intro-plus-typed-picks.md))

The page's unavailable state is then only for a missing key or a provider outage. This is Unit 2
of the AI planner plan.

## Out of scope

- **Frontend changes.** The page is built. The only frontend edit is the contract test entries.
- **Renaming, pinning, sharing or searching chats.**
- **A second provider** (`AnthropicLlmClient`), per the llm-integration skill.
- **Streaming the pick reasons one by one** (ADR-019, revisit when).
- **Answers mixing events and clubs.** The schema allows one kind per answer.
- **Model-written follow-up chips.** The page chooses them by answer kind.
- **Deploying.** The ALB and nginx notes below are checked locally only; Arpan deploys.

## Decisions taken

**Carried from the approved plan** (Arpan, 2026-09-15):

- Chat model `gpt-4.1-mini`, configurable through `OPENAI_CHAT_MODEL`. A blank key fails fast: 503
  `AI_SERVICE_UNAVAILABLE`, where search would degrade.
- **Chat cap.** 15 chats. Creating a 16th deletes the least recently active one in the same
  transaction, under a lock on the user's row, so two tabs cannot leave 16.
- **Daily quota.** 15 messages per user per day, across all chats, reset at midnight America/Toronto.
  - It lives in `planner_daily_usage`, not in a count of messages, so deleting a chat never
    returns quota.
  - It is spent before the provider call: a conditional upsert with `message_count < 15`, and zero
    rows means 429.
- **Ownership.** Another user's chat is a 404, never a 403.
- **Size limits.** A prompt is at most 1,000 characters (`MAX_PROMPT_LENGTH`). The last 10 messages
  go to the model. A chat holds at most 40 messages.
- **Retrieval window.** Events with `end_time > now()` and `date_time < now() + 30 days`. The model
  gets the current date and time in America/Toronto.
- **Candidates.**
  - Sources: hybrid search on the message and the previous user turn, the user's saved and going
    events, and upcoming events from followed clubs.
  - Re-ranked in Java: boosts for topic ∩ interests, a followed organizer, and running now when the
    prompt says now or tonight.
  - At most 15 events and 6 clubs. Labels come from the catalogue, not slugs.
- **Grounding.** Every pick id not in this turn's candidate set is dropped before storing or sending.
- **Stored chats are rehydrated on every read.** Cards are fresh `EventDTO` / `ClubDTO`, and an ended
  or deleted item is left out.
- **Transport.** `SseEmitter` on virtual threads, read by `fetch`, since `EventSource` cannot send
  the Authorization header.
- **Logging.** No prompt text or provider body is ever logged (`common/Logs`), and provider errors
  become application exceptions.
- **Title.** The first user message, cut to 60 characters, with no extra LLM call.

**Fixed by the built page** (Arpan, 2026-09-16, [planner chat UI spec](2026-09-16-planner-chat-ui.md)):

- **Frames.** An answer streams as `delta {text}` frames, then one `done` or `error` frame.
  - `done` is `{messageId, picks, events, clubs, usage, conversation}`, the last being the chat
    summary.
  - `error` is `{code, message}`, and its `message` is shown to the user as written.
- **Refused before streaming.** 429 at the limit and 503 without a provider arrive as HTTP statuses,
  not frames.
- **Refund.** A reply that fails is refunded.
- **Contract.** The eight `ApiPlanner*` shapes join `contracts/api-dto-fields.json`, and both
  contract tests cover them.

**Decided in this session** (Arpan, 2026-09-16):

- **One streamed call with a strict JSON schema** `{intro, kind, picks[{id, reason}]}`, intro first.
  The server reads the intro string out of the JSON as it arrives and sends it as `delta` frames,
  then validates the picks when the stream ends. One chat call per message.
  - Rejected: two calls (intro, then picks), and plain text followed by a delimited JSON block.
  - A real choice between alternatives, so a Proposed ADR at wrap-up.
- **A failed reply stores nothing.** On a provider error or timeout, the user message and the reply
  are both discarded and the quota is refunded. The chat's title and `last_active_at` are
  untouched. Try again then works as the page already does.
  - So `planner_messages` has no status column, and every stored message is sent as `complete`.
- **Stop discards but still counts.** When the client disconnects mid-stream, the provider stream is
  cancelled and nothing is stored. The message stays counted, because the call was paid for.
- **Picks are a `JSONB` column** on `planner_messages`, `[{kind, id, reason}]`, always read with
  their message. There is no child table.
- **History carries picks.** Each earlier assistant turn goes to the model with its picks as short id
  and name lines. The previous answer's items join this turn's candidates: its clubs' upcoming
  events, or its events' organizers. That is how Upcoming events from these clubs resolves.
- **Embedding failure degrades.** If the key is set but the embedding call fails, retrieval runs
  keyword-only plus saved, going and followed-club events, and the chat call still runs.
- **An empty chat stays.** A chat whose first reply failed or was stopped stays in the list titled
  New chat and counts toward the 15. The first completed reply sets its title from its user message.
  `last_active_at` is bumped only by a completed reply.
- **A full chat is an `error` frame.** A send into a chat already holding 40 messages streams one
  `error` frame, code `CONVERSATION_FULL`, whose message tells the person to start a new chat. The
  page already shows an `error` frame's message as written, so no frontend change. The message is
  refunded and nothing is stored. Option (b) of the spec's open question.

## Open questions

None.

## Shipped differently

Recorded at wrap-up, 2026-09-16. Each is also in [`ai-planner.md`](../docs/architecture/ai-planner.md).

- **A fifth retrieval source: the soonest-starting events.** The four sources above could not answer *what is on right now?*, which names nothing search can match.
- **An answer keeps at most 6 picks** (`PlannerLimits.MAX_PICKS`), which the spec did not state.
- **The search leg matches any word of the prompt**, not all of them as the search box does; an all-words query matched nothing for a sentence.
- **The 40-message check runs before the message is spent** rather than spending and refunding; the person sees the same.
- **A chat deleted while its reply streams** gets an `error` frame, `CONVERSATION_GONE`, and a refund.
- **The three planner tables are plain SQL, not JPA entities.**
- **`DefaultExceptionHandler` changed beyond the 503 entry**: five handlers preset `application/json`, because a 429 asked for as `text/event-stream` left as a 500 ([BUG-059](../bugs/fixed_bugs.md#bug-059)).
- **A signed-out caller gets 403**, as every other signed-in route here does, where a 401 might have been assumed.
- **ADR-022 was not written.** The chat cap, eviction and separate quota table were decided in the approved plan; recording them is left to Arpan.

## Files expected to change

- **Migration** `backend/src/main/resources/db/migrations/V36__create_planner_tables.sql`
  (read `skills/database-lifecycle/SKILL.md` first, and confirm V36 is free on `origin/develop` and
  `origin/main`). It creates:
  - `planner_conversations (id UUID, user_id FK ON DELETE CASCADE, title, created_at, last_active_at)`,
    indexed `(user_id, last_active_at DESC)`
  - `planner_messages (id BIGSERIAL, conversation_id FK ON DELETE CASCADE, role CHECK, content, picks JSONB, created_at)`
  - `planner_daily_usage (user_id, usage_date, message_count, PK (user_id, usage_date))`
- **LLM layer** `backend/src/main/java/com/campusvibe/ai/`:
  - `client/LlmClient`, `client/OpenAiLlmClient`: Chat Completions with `stream: true` and a
    `json_schema` response format. Retries only before the first token.
  - `config/OpenAiProperties` gains `chatModel` and `maxOutputTokens`, with a matching block in
    `application.yml`.
  - `prompt/PromptTemplateService` and `resources/prompts/planner-system.txt`. User text sits inside
    delimiters.
- **Planner feature** `ai/feature/planner/`:
  - `PlannerController`
  - `PlannerConversationService`: cap, eviction, ownership, hydration
  - `PlannerUsageService`: Toronto day, spend, refund
  - `PlannerRetrievalService`
  - `PlannerReplyService`: stream, incremental intro reader, validation, store
  - entities and repositories
  - the eight DTO records
  - exceptions mapped in `exception/DefaultExceptionHandler`
- **Search.** `search/SearchRepository.java` gains a windowed, limited candidate query for events
  and clubs.
- **Security.** `security/SecurityFilterChainConfig.java`: the planner routes are authenticated, and
  the SSE async dispatch must not be re-authorised into a 403.
- **Streaming through production.** An `X-Accel-Buffering: no` header, so EB's nginx does not buffer
  the stream. A `:` keep-alive comment every 15 seconds, under the ALB's 60-second idle timeout. No
  change to `deploy/eb/.platform` is expected.
- **Contract.** `contracts/api-dto-fields.json`, `ApiContractTest`, `frontend/app/__tests__/api-contract.test.ts`.
- **Config.** `docker/.env.example`, and the `OPENAI_CHAT_MODEL` row in `docker/EB-DEPLOYMENT.md`.
- **Tests.** `LlmClient` is mocked everywhere; no test calls OpenAI.
  - Unit tests:
    - the incremental intro reader, with chunks split inside escapes and unicode
    - pick validation (an unknown id, an ended event, a mixed kind)
    - the re-rank
    - the Toronto midnight boundary, including a daylight-saving day
    - prompt building
  - Testcontainers ITs:
    - a 16th create evicts the least recently active chat, and concurrent creates never pass 15
    - the 16th message is a 429, and deleting a chat does not restore quota
    - a failure refunds the message and stores nothing, while a disconnect stores nothing and keeps
      the count
    - another user's chat is a 404
    - an ended event is never a candidate or a hydrated card
    - the SSE happy path's frames match `planner-api.ts`
    - a blank key is a 503
- **Mapped docs:**
  - `docs/architecture/ai-planner.md` (its backend half)
  - `llm-api-key-management.md` (`ai/`)
  - `search.md` (`search/`)
  - `api-and-caching.md` (`exception/`, `contracts/`)
  - `user-roles.md` (`security/`)
  - `scripts/docs-map.json` gains the planner backend paths under `ai-planner.md`

## Verification

- `node scripts/verify.mjs --all --full`: plain `verify.mjs` ignores uncommitted work
  (`rules/ci-and-build.md`).
- On the local stack, `docker compose up -d --build` with a real `OPENAI_API_KEY` in `docker/.env`,
  plus one ended event, one running now and one next week:
  - `curl -N` the message endpoint with a token, and see `delta` frames then a `done` whose ids are
    real and exclude the ended event.
  - In the browser (`browser-automation` skill), ask *what's happening right now?* and *plan my
    weekend*. Then tap a follow-up chip, reload a chat, delete one, and look for console errors.
  - Close the todo item for the 390px check, the clubs answer, the 15-of-15 notice and a 429, or
    say which were not seen.
  - Blank the key and see the 503 state.

## To update at wrap-up

- **`docs/architecture/ai-planner.md`:**
  - the backend half: schema, retrieval, the incremental intro reader, eviction and quota
    transactions
  - remove the *backend is unbuilt* banner and the contract gap
- **`docs/README.md`:** the `ai-planner.md` row. Also the ADR-019 and ADR-020 rows in
  `docs/decisions/README.md`, which still read Proposed although both are Accepted.
- **`llm-api-key-management.md`:** the chat model property, and the fail-fast rule for the planner.
- **`search.md`:** the planner's candidate query.
- **Proposed ADR-021:** one streamed call with a strict JSON schema, with the intro read out as it
  arrives.
- **Proposed ADR-022**, if Arpan wants it recorded: server-stored chats with a 15 cap and
  least-recently-active eviction, and a quota table separate from messages (item b of the plan).
- **`rules/`:**
  - `db-migrations.md`: the next migration is V37.
  - `backend-java.md` or `contracts.md`: any SSE or async security trap hit, with its bug id.
- **`todo.md`:**
  - close the planner backend item, the `LlmClient` item and, if checked, the browser look item
  - close the interests-are-unread item, since retrieval now reads them
- **`STATUS.md`:**
  - a shipped line
  - *Now*: deploy the planner backend and frontend together, with `OPENAI_CHAT_MODEL` set on EB
