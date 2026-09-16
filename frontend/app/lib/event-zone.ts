/**
 * Every event takes place in one time zone, Montreal's (Arpan, 2026-09-16), so
 * event dates and times are formatted and parsed here and nowhere else.
 *
 * A bare `toLocaleTimeString(undefined, …)` formats in whatever zone the
 * process runs in: UTC on the server, so a server-rendered event page read
 * 7:00 PM for an event at 3:00 PM, and the viewer's own zone in the browser.
 * Pinning the zone makes both sides print the same clock time, which is also
 * why no zone label is shown: there is only ever one. The locale is pinned for
 * the same reason (BUG-025).
 *
 * The API still sends instants (`…Z`); only what people read and type is in
 * this zone.
 */

export const EVENT_TIME_ZONE = "America/Toronto";
export const EVENT_LOCALE = "en-US";

const inZone = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(EVENT_LOCALE, { timeZone: EVENT_TIME_ZONE, ...options });

const dateLong = inZone({ weekday: "long", year: "numeric", month: "long", day: "numeric" });
const dateShort = inZone({ weekday: "short", month: "short", day: "numeric" });
const monthDay = inZone({ month: "short", day: "numeric" });
const weekday = inZone({ weekday: "short" });
const time = inZone({ hour: "numeric", minute: "2-digit" });
const parts = inZone({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** `Thursday, September 17, 2026` */
export const formatEventDateLong = (date: Date) => dateLong.format(date);

/** `Thu, Sep 17` */
export const formatEventDateShort = (date: Date) => dateShort.format(date);

/** `Sep 17` */
export const formatEventMonthDay = (date: Date) => monthDay.format(date);

/** `Thu` */
export const formatEventWeekday = (date: Date) => weekday.format(date);

/** `3:00 PM` */
export const formatEventTime = (date: Date) => time.format(date);

/** `Fri, Sep 18 – Sun, Sep 20`, or one date when both fall on the same day. */
export const formatEventDateRange = (start: Date, end: Date) => dateShort.formatRange(start, end);

/** The wall-clock fields of `date` in the event zone. */
function wallClock(date: Date) {
  const values: Record<string, number> = {};
  for (const part of parts.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** How far the event zone's clock is ahead of UTC at `instant`, in ms (negative here). */
function zoneOffsetMs(instant: number): number {
  const w = wallClock(new Date(instant));
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A `datetime-local` value (`2026-10-01T18:00`) for `date`, in the event zone. */
export function toEventInputValue(date: Date): string {
  const w = wallClock(date);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * The instant a `datetime-local` value names in the event zone, whatever zone
 * the browser is in. Null for an empty or malformed value.
 *
 * The offset is read at a first guess and checked again at the answer, so the
 * days the clocks change resolve: a time in the skipped spring hour lands an
 * hour away rather than throwing, and a repeated autumn time takes its first
 * occurrence.
 */
export function fromEventInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc)) return null;
  const firstOffset = zoneOffsetMs(asUtc);
  let instant = asUtc - firstOffset;
  const secondOffset = zoneOffsetMs(instant);
  if (secondOffset !== firstOffset) instant = asUtc - secondOffset;
  return new Date(instant);
}
