import { hasEnded } from "@/app/lib/event-time";
import { formatEventDateShort, formatEventTime } from "@/app/lib/event-zone";
import type { EventInstance, MyEvent, MyEventStatus, MyEventsTab } from "@/app/types";

// Pure helpers behind the My events page: tab selection, day grouping and the
// month grid for the date filter. Kept out of the components so the date maths
// stays testable.

export const WEEKDAY_INITIALS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MS_PER_DAY = 86_400_000;

export function isMyEventsTab(value: string | null | undefined): value is MyEventsTab {
  return value === "going" || value === "saved" || value === "past";
}

/** Midnight local time, so two dates can be compared by calendar day. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** The same calendar day as `date`, shifted by `days`, at midnight. */
export function addDays(date: Date, days: number): Date {
  const shifted = startOfDay(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

/**
 * An event is past once it has ended — the moment its end time passes, not
 * when it starts and not at midnight (V35, Arpan 2026-09-15).
 *
 * So a running event stays under Going or Saved until it is over, a
 * three-day festival stays there all three days, and an event that ended at
 * noon is in Past the same afternoon. Until end times existed this was
 * whole-day based, which filed nothing past before midnight and every
 * multi-day event past on its second day.
 */
export function isPastEvent(
  event: Pick<EventInstance, "dateTime" | "endTime">,
  now: Date = new Date(),
): boolean {
  return hasEnded(event, now);
}

/**
 * The days the date filter may anchor at, per tab. `null` means unbounded.
 *
 * Both ranges include today, because since events have end times today can
 * hold both kinds: the talk that ended at noon is past, the party tonight is
 * not. Going and Saved start at today and look forwards; Past ends at today
 * and looks back.
 */
export function anchorRangeForTab(
  tab: MyEventsTab,
  today: Date = new Date(),
): { min: Date | null; max: Date | null } {
  return tab === "past"
    ? { min: null, max: startOfDay(today) }
    : { min: startOfDay(today), max: null };
}

/**
 * Where a tab points before the user picks anything: today, looking forwards
 * or back. It is the edge of each tab's range, so the whole tab is visible
 * until the user narrows it.
 */
export function defaultAnchorForTab(tab: MyEventsTab, today: Date = new Date()): Date {
  return startOfDay(today);
}

/** Whether a day may be picked while `tab` is open. */
export function isAnchorAllowed(
  date: Date,
  tab: MyEventsTab,
  today: Date = new Date(),
): boolean {
  const { min, max } = anchorRangeForTab(tab, today);
  const day = startOfDay(date).getTime();
  if (min && day < min.getTime()) return false;
  if (max && day > max.getTime()) return false;
  return true;
}

/**
 * Which badge a card shows. Going wins when an event is both: a confirmed
 * commitment is the more useful thing to see at a glance than a bookmark.
 */
export function myEventStatus(myEvent: MyEvent): MyEventStatus {
  return myEvent.going ? "going" : "saved";
}

/**
 * The events a single tab should show, sorted for display.
 *
 * `anchor` is the day picked in the date filter (today by default). Going and
 * Saved read it as still happening on or after it, by the event's end day, so
 * a festival that began before the anchor still shows while it runs. Past reads
 * it as started on or before it. In both directions the control means anchor
 * the list at this date.
 *
 * Past deliberately ignores the going/saved split: once an event is over, both
 * kinds belong in the same history, and each card still shows its own badge.
 *
 * Going and Saved can both show the same event — they are independent
 * relations, so an event you bookmarked and then RSVPed to belongs in each.
 */
export function selectMyEvents(
  myEvents: MyEvent[],
  tab: MyEventsTab,
  anchor: Date,
  now: Date = new Date(),
): MyEvent[] {
  const anchorDay = startOfDay(anchor).getTime();

  const selected = myEvents.filter((myEvent) => {
    const { event } = myEvent;
    const startDay = startOfDay(event.dateTime).getTime();
    const endDay = startOfDay(event.endTime).getTime();
    const isPast = isPastEvent(event, now);

    if (tab === "past") return isPast && startDay <= anchorDay;
    if (isPast || endDay < anchorDay) return false;
    return tab === "going" ? myEvent.going : myEvent.saved;
  });

  // Upcoming reads forwards; history reads most recent first.
  return selected.sort((a, b) =>
    tab === "past"
      ? b.event.dateTime.getTime() - a.event.dateTime.getTime()
      : a.event.dateTime.getTime() - b.event.dateTime.getTime(),
  );
}

export type MyEventDayGroup = {
  key: string;
  date: Date;
  events: MyEvent[];
};

/**
 * Buckets events under the day they happen on. Expects the input already
 * ordered (as `selectMyEvents` returns it) — it only ever merges neighbours.
 */
export function groupMyEventsByDay(myEvents: MyEvent[]): MyEventDayGroup[] {
  const groups: MyEventDayGroup[] = [];

  for (const item of myEvents) {
    const date = startOfDay(item.event.dateTime);
    const key = date.toDateString();
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.events.push(item);
    } else {
      groups.push({ key, date, events: [item] });
    }
  }

  return groups;
}

/** "Today" / "Tomorrow" / "Yesterday", falling back to "Tue, Aug 25". */
export function formatDayLabel(date: Date, today: Date = new Date()): string {
  const dayDiff = Math.round(
    (startOfDay(date).getTime() - startOfDay(today).getTime()) / MS_PER_DAY,
  );

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  if (dayDiff === -1) return "Yesterday";

  // Pinned rather than following the host locale. The three labels above are
  // hardcoded English, so an unpinned format produced a mixed-language list on
  // a non-English machine — `Today` directly above `mar. 25 aout` — and made
  // the test for this function pass only on an en-US host (BUG-025).
  //
  // If the UI is ever localised, this is one of the places to revisit, along
  // with the Today/Tomorrow/Yesterday strings that make it necessary.
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Ticket-style stamp for a card: "Sun, Aug 9 · 1:00 PM". Montreal time with no
 * zone label, since every event is in that one zone (lib/event-zone.ts).
 */
export function formatEventDateTime(date: Date): string {
  return `${formatEventDateShort(date)} · ${formatEventTime(date)}`;
}

/**
 * Six weeks of days covering `month`, always starting on a Sunday. A fixed 42
 * cells keeps the popup from resizing as you page through months.
 */
export function buildMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, offset) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + offset);
    return day;
  });
}
