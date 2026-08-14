import type { EventInstance } from "@/app/types";

// Builds a Google Calendar "template" link — the prefilled new-event form that
// opens when the user clicks through. No API key, no OAuth, no backend: the
// whole event travels in the query string.
//
// Docs: https://support.google.com/calendar (Add to Calendar links)

const GOOGLE_CALENDAR_TEMPLATE = "https://calendar.google.com/calendar/render";

// EventInstance has no end time yet, so every event is assumed to run two
// hours. Swap this for the real end once the backend carries one — Google
// requires a start/end pair and silently rejects a lone start.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * Google's basic-format UTC stamp: 20261015T140000Z.
 *
 * toISOString() is already UTC, so this only strips the separators and the
 * milliseconds Google will not parse.
 */
function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function buildGoogleCalendarUrl(
  event: EventInstance,
  organizerName: string,
  options: { durationMs?: number; timeZone?: string } = {},
): string {
  const { durationMs = DEFAULT_DURATION_MS, timeZone } = options;

  const start = event.dateTime;
  const end = new Date(start.getTime() + durationMs);

  // "Tech Conference | ACME Corp" — the pipe survives as %7C.
  const text = `${event.title} | ${organizerName}`;

  // Venue name and street address together: Google resolves the address, and
  // the name is what tells you which room you are walking to.
  const location = [event.location.name, event.location.address]
    .filter(Boolean)
    .join(", ");

  // encodeURIComponent — not URLSearchParams, which would encode spaces as "+"
  // rather than the %20 that is safe everywhere. `dates` is skipped because the
  // stamps are digits, "T", "Z" and "/", all already URL-safe, and Google's own
  // examples leave that slash bare.
  //
  // `ctz` stays absent unless a caller asks for it: the stamps above are UTC,
  // and naming a second timezone alongside them is what makes these links land
  // an hour off.
  const query = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(text)}`,
    `dates=${toUtcStamp(start)}/${toUtcStamp(end)}`,
    event.details ? `details=${encodeURIComponent(event.details)}` : null,
    location ? `location=${encodeURIComponent(location)}` : null,
    timeZone ? `ctz=${encodeURIComponent(timeZone)}` : null,
  ]
    .filter(Boolean)
    .join("&");

  return `${GOOGLE_CALENDAR_TEMPLATE}?${query}`;
}
