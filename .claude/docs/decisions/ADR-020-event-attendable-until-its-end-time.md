# ADR-020 — An event is still attendable until its required end time

**Status:** Proposed
**Date:** 2026-09-16
**Decided in:** the event end time `/start` session, recorded in
[`2026-09-15-event-end-time.md`](../../specs/2026-09-15-event-end-time.md)
**Participants:** main session · **Approved by:** Arpan chose the options on
2026-09-15 and 2026-09-16; the record itself awaits his status change
**Implemented in:** V35, `EventService`, `SearchRepository`,
`frontend/app/lib/event-time.ts` and `lib/event-zone.ts` — see
[`api-and-caching.md`](../architecture/api-and-caching.md) and
[`club-administration.md`](../architecture/club-administration.md)

## Context

Until V35 an event held only its start, `events.date_time`
(`V3__create_event_table.sql:6`). Every check of where an event stood in time
compared that start, each in its own way:

- **Search** filtered `e.date_time >= now()` (`SearchRepository.java`, both event
  queries), so an event vanished from results the moment it began.
- **The dashboards** filtered `dateTime >= now` and filed a running event under
  past.
- **My events** called an event past only once its whole calendar day was over,
  so a multi-day event went to Past on its second day.
- **`EventCard`'s Happening now badge** compared UTC calendar dates, wrong for
  every Montreal evening.
- **Google Calendar export** guessed a two-hour length
  (`google-calendar.ts`, `DEFAULT_DURATION_MS`).

The AI planner promises to suggest only events that are running or still to
come, which none of these could answer.

## Options considered

### A default duration, no new column

Treat every event as lasting two hours from its start.

- **For:** no migration, no form field, no contract change.
- **Against:** wrong for every event that is not two hours long, which is most
  of them: a festival, a fair, a three-hour workshop. A running festival would
  still be filed as past, and the planner would still drop it.
- **Not taken.**

### Upcoming only, by start

Keep comparing the start everywhere, and accept that running events are past.

- **For:** no change at all.
- **Against:** fails the one question the planner exists to answer, *what is on
  right now?*
- **Not taken.**

### An optional end time

Add `end_time` but allow it to be empty, falling back to a default duration.

- **For:** no pressure on clubs to fill another field; old rows need no
  backfill.
- **Against:** every reader must implement the fallback, so the several
  definitions this decision exists to remove come back as several fallbacks.
- **Not taken.**

### A required end time, one definition everywhere

`end_time` is `NOT NULL`, after the start and at most 14 days later, and an event
is still attendable while `end_time > now()`.

- **For:** one comparison of instants, the same in SQL, Java and TypeScript. A
  running event is found, badged and listed as upcoming, and an ended one is not.
- **Against:** a new required field on the create and edit form; existing rows
  need a backfill, which V35 does as start plus two hours, the length export
  already assumed. The 14-day cap refuses a longer run, such as a
  semester-long exhibition.
- **Taken.**

## Decision

Every event has a required end, after its start and at most 14 days later.
Enforced in `EventService.requireValidTimes` as a 400 and by V35's CHECK
constraints. An event is **still attendable** while `end_time > now()` and
**ongoing** while `date_time <= now() < end_time`, and every read path that means
either uses exactly that comparison:

- search
- `GET /api/v1/events?upcoming=true`, opt-in rather than the default because the
  manage Events page lists past events too
- the dashboards and My events
- the Happening now badge

Event times are shown and entered in one zone, America/Toronto, with no zone
label (Arpan, 2026-09-16); the API carries instants.

## Consequences

- **Easy:** the planner can retrieve running and future events with one query.
  Calendar export uses the real end. A multi-day event stays visible and badged
  for its whole run.
- **Costs:**
  - Every event fixture and every create request must carry an end; the ITs that
    build events were changed for it.
  - The My events Past tab now shares today with Going and Saved, since today can
    hold both kinds.
- **Forecloses:** events longer than 14 days without a new decision; all-day
  events as a distinct kind; a per-event time zone.

## Revisit when

- A club needs an event longer than 14 days, such as an exhibition or a term-long
  series. The answer may be recurrence rather than a longer cap.
- Events outside Montreal's zone become real, which reopens the fixed-zone half.
- Event lifecycle status lands: a cancelled or draft event must also leave the
  attendable reads, alongside the end-time filter.
