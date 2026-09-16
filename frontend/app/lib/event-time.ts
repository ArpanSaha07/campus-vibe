import { fromEventInputValue, toEventInputValue } from "@/app/lib/event-zone";
import type { EventInstance } from "@/app/types";

/**
 * The one definition of where an event is in time, shared by every card, list
 * and filter (V35, Arpan 2026-09-15). The backend uses the same instants:
 * search and `GET /api/v1/events?upcoming=true` keep an event while
 * `end_time > now()`.
 *
 * Instants, never calendar days. Comparing days is what made a running event
 * look past on the dashboards, and what put the Happening now badge on the
 * wrong events for a Montreal evening, once the server's date had turned.
 */

type Timed = Pick<EventInstance, "dateTime" | "endTime">;

/** Over: the end has passed. Such an event is history, not something to attend. */
export function hasEnded(event: Timed, now: Date = new Date()): boolean {
  return event.endTime.getTime() <= now.getTime();
}

/** Running right now: started, not yet ended. */
export function isOngoing(event: Timed, now: Date = new Date()): boolean {
  return event.dateTime.getTime() <= now.getTime() && !hasEnded(event, now);
}

/** The longest an event may run. `EventService.MAX_EVENT_LENGTH` and V35 agree. */
export const MAX_EVENT_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

/** What the form fills the end with once a start is picked: two hours later. */
export const DEFAULT_EVENT_LENGTH_MS = 2 * 60 * 60 * 1000;

/**
 * A `datetime-local` value moved by `ms`, read and written in Montreal time
 * (`2026-09-01T18:00` → `2026-09-01T20:00`). Empty for an empty or invalid
 * value, so the form never writes `Invalid Date` into a field.
 */
export function shiftLocalDateTime(value: string, ms: number): string {
  const start = fromEventInputValue(value);
  if (!start) return "";
  return toEventInputValue(new Date(start.getTime() + ms));
}

/**
 * Why a start and end pair would be refused, in words for the form, or an
 * empty string when it is fine. A missing value is not an error here: the
 * form keeps Save disabled until both are filled, and says so.
 */
export function eventTimesError(start: string, end: string): string {
  if (!start || !end) return "";
  const startMs = fromEventInputValue(start)?.getTime();
  const endMs = fromEventInputValue(end)?.getTime();
  if (startMs === undefined || endMs === undefined) return "";
  if (endMs <= startMs) return "The event has to end after it starts.";
  if (endMs - startMs > MAX_EVENT_LENGTH_MS) return "An event can run for at most 14 days.";
  return "";
}
