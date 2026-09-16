# Event end time and one definition of still attendable

**Status:** draft · **Date:** 2026-09-15

Unit 1 of 3 of the AI planner rebuild (planner backend and the chat page follow, each with its own spec).

## Goal

Every event has a required end time, so the platform can tell a running event from an ended one. Today `events` holds only a start (`V3__create_event_table.sql:6`), and every past check compares the start: search drops an event the moment it begins (`SearchRepository.java:103,119`), the dashboards and My events file a running event under past, and Google Calendar export guesses a two-hour length (`google-calendar.ts:11-14`). After this ships, an event is still attendable while `end_time > now()`, and that one definition is used by search, by a new `GET /api/v1/events?upcoming=true` filter the planner will retrieve from, and by every frontend past/upcoming split. A running event carries a Happening now badge.

## Out of scope

- Anything planner: retrieval, conversations, the LLM client, the chat page. Units 2 and 3.
- Wiring the homepage to the API; it still reads `data/data.ts`. `data.ts` gets an `endTime` only so it type-checks.
- Recurring events, time zones per event, all-day events as a distinct kind.
- Changing the default of `GET /api/v1/events` — without `upcoming=true` it still returns everything, because the manage Events page shows past events.
- Event lifecycle status (`DRAFT` / `PUBLISHED`).

## Decisions taken

- End time is **required** on create and edit; existing rows are backfilled to `date_time + 2 hours` and the column is `NOT NULL`. Arpan, 2026-09-15.
- Still attendable means `end_time > now()`, one definition everywhere. Ongoing means `date_time <= now() < end_time`. Arpan, 2026-09-15.
- An event lasts at most **14 days**: `end_time > date_time` and `end_time <= date_time + 14 days`, checked in `EventService` (400) and as a `CHECK` constraint. Arpan, 2026-09-15.
- **All frontend past/upcoming splits switch to end time**: My events Past tab (`lib/my-events.ts` `isPastEvent`), `(protected)/dashboard/page.tsx:25`, `manage/[clubId]/page.tsx:62`, `manage/[clubId]/events/page.tsx:64-68`, `MyEventCard.tsx:22`. Arpan, 2026-09-15.
- Happening now badge on **EventCard, the event page and MyEventCard** — not the search dropdown. Styled per `design-guidelines.md:78` (`ink-900` on `sun-300`, mono uppercase). Arpan, 2026-09-15.
- `GET /api/v1/events` gains an optional `upcoming=true`, rather than changing its default. Arpan, with the approved planner plan, 2026-09-15.
- Google Calendar export uses the real end time and `DEFAULT_DURATION_MS` is deleted — the file's own comment asks for exactly that. Claude, following `google-calendar.ts:11-13`.
- The form defaults the end to start + 2h when a start is picked and the end is still empty; it never overwrites an end the user typed. Claude, a form detail with no lasting consequence.
- **An ADR is warranted** for the attendable definition (Proposed, written at wrap-up): it constrains every future read path, and the alternatives — a default duration, or upcoming-only — were real. Arpan flips its status.

## Open questions

- **EventCard's today check** (`EventCard.tsx:18`) compares UTC date strings, so it is wrong for Montreal evenings independently of this unit. Replacing it with the ongoing check is in scope; if it drives anything other than the badge, confirm during implementation before changing that behaviour. Blocks nothing else.

## Files expected to change

- **Migration:** `backend/src/main/resources/db/migrations/V35__add_event_end_time.sql` — add column, backfill, `SET NOT NULL`, the two `CHECK`s, index on `end_time`. Confirm V35 is free on `origin/develop` and `origin/main` first.
- **Backend:** `event/Event.java`, `EventCreateRequest.java`, `EventUpdateRequest.java`, `EventController.java` (create at `:95`, `list` gains `upcoming`), `EventService.java` (validation, `listUpcoming`), `EventRepository.java` (`findByEndTimeAfterOrderByDateTime` with the organizer graph), `EventMapper.java`, `EventDTO.java`, `search/SearchRepository.java` (both event queries).
- **Backend tests:** `SearchIT.java` (ongoing found, ended not), `EventUpdateIT.java` (missing, inverted and over-14-day end → 400), a create-path IT, `EventLookupIT.java` (`upcoming=true`), and `endTime` set in the fixtures of `MyEventsIT`, `EventPhotoIT`, `EventMediaIT`.
- **Contract:** `contracts/api-dto-fields.json` (`EventDTO.endTime`), `api-contract.test.ts`; `ApiContractTest` reads the JSON.
- **Frontend:** `app/types/index.ts` (`ApiEvent.endTime`, `EventInstance.endTime`), `lib/adapters.ts`, `lib/event.tsx` (`NewEvent.endTime`), `lib/google-calendar.ts`, `lib/my-events.ts`, `components/event/CreateEventForm.tsx` (create and edit), `components/event/EventCard.tsx`, `components/my-events/MyEventCard.tsx`, `(main)/events/[eventId]/page.tsx`, the three dashboard pages above, `data/data.ts`; a shared `isOngoing` / `hasEnded` helper beside `isPastEvent`.
- **Frontend tests:** `adapters.test.ts`, `event.test.ts`, `my-events.test.ts`, `google-calendar.test.ts`, the form's test.
- **Docs and rules mapped:** `api-and-caching.md` (`event/`, `types/`, `contracts/`), `search.md` (banner only), `rules/contracts.md`, `rules/db-migrations.md`, `skills/database-lifecycle`.

## Verification

- `node scripts/verify.mjs --full` — lint, type-check, Jest, build with the backend down, unit tests and the Testcontainers ITs.
- `docker compose up -d --build backend frontend`; Flyway logs V35 applied, and `SELECT count(*) FROM events WHERE end_time IS NULL` returns 0.
- curl, with one ended, one running and one future event created through the dashboard:
  - `GET /api/v1/events?upcoming=true` returns the running and future events, ordered by start.
  - `GET /api/v1/events` still returns all three.
  - `GET /api/v1/events/search?q=<running title>` finds the running event.
  - `PUT /api/v1/events/{id}` without `endTime`, with an end before the start, or with a 15-day span → 400 with a readable message.
- Browser on `localhost:3000`: the create form rejects a missing end and prefills start + 2h; the running event shows Happening now on its card, its page and in My events, and sits under Going, not Past; Add to Google Calendar opens with the real end.

## To update at wrap-up

- `docs/decisions/ADR-018-event-attendable-until-its-end-time.md` (ADR-017 went to the planner answer shape on 2026-09-16) (Proposed) plus its rows in `docs/decisions/README.md` and `docs/README.md`.
- `rules/backend-clubs.md` or a new line in `rules/contracts.md`: any new event read path that means still attendable filters `end_time > now()`, never `date_time`.
- `api-and-caching.md` — the `upcoming` parameter; `search.md` banner — the filter moved to `end_time`.
- `product.md` — Search and Club dashboard sections.
- `TODO/tasks-completed.md`, `STATUS.md` shipped line; this spec to `shipped`.
