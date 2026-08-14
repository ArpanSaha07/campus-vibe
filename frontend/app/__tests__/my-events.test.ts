import {
  anchorRangeForTab,
  buildMonthGrid,
  defaultAnchorForTab,
  formatDayLabel,
  groupMyEventsByDay,
  isAnchorAllowed,
  isPastEvent,
  myEventStatus,
  selectMyEvents,
} from "@/app/lib/my-events";
import type { EventInstance, MyEvent, MyEventsTab } from "@/app/types";

// "Now" is fixed mid-afternoon so the tests can pin the tricky case: an event
// that has already started today is still upcoming, not past.
const NOW = new Date(2026, 7, 9, 15, 0); // Sun 9 Aug 2026, 3:00 PM local

function myEvent(
  eventId: string,
  dateTime: Date,
  relation: { going?: boolean; saved?: boolean },
): MyEvent {
  return {
    going: relation.going ?? false,
    saved: relation.saved ?? false,
    event: { eventId, dateTime } as EventInstance,
  };
}

const startedEarlierToday = myEvent("started-today", new Date(2026, 7, 9, 9, 0), { going: true });
const laterToday = myEvent("later-today", new Date(2026, 7, 9, 20, 0), { saved: true });
const nextWeek = myEvent("next-week", new Date(2026, 7, 16, 18, 0), { going: true });
const savedNextWeek = myEvent("saved-next-week", new Date(2026, 7, 17, 18, 0), { saved: true });
const bothNextWeek = myEvent("both-next-week", new Date(2026, 7, 18, 18, 0), {
  going: true,
  saved: true,
});
const yesterday = myEvent("yesterday", new Date(2026, 7, 8, 18, 0), { going: true });
const lastMonth = myEvent("last-month", new Date(2026, 6, 14, 18, 0), { saved: true });

const all = [
  startedEarlierToday,
  laterToday,
  nextWeek,
  savedNextWeek,
  bothNextWeek,
  yesterday,
  lastMonth,
];

const ids = (events: MyEvent[]) => events.map((item) => item.event.eventId);

describe("isPastEvent", () => {
  it("keeps an event upcoming for its whole day, even after it has started", () => {
    // Began at 09:00 with NOW at 15:00 — still today, so still upcoming.
    expect(isPastEvent(new Date(2026, 7, 9, 9, 0), NOW)).toBe(false);
    expect(isPastEvent(new Date(2026, 7, 9, 23, 59), NOW)).toBe(false);
  });

  it("moves an event to past once its day is over", () => {
    expect(isPastEvent(new Date(2026, 7, 8, 23, 59), NOW)).toBe(true);
  });
});

describe("selectMyEvents", () => {
  it("keeps today's events under going all day, whatever the time", () => {
    expect(ids(selectMyEvents(all, "going", NOW, NOW))).toEqual([
      "started-today",
      "next-week",
      "both-next-week",
    ]);
    expect(ids(selectMyEvents(all, "past", NOW, NOW))).not.toContain("started-today");
  });

  it("shows saved events on the saved tab", () => {
    expect(ids(selectMyEvents(all, "saved", NOW, NOW))).toEqual([
      "later-today",
      "saved-next-week",
      "both-next-week",
    ]);
  });

  it("lists an event that is both saved and going under each tab", () => {
    expect(ids(selectMyEvents(all, "going", NOW, NOW))).toContain("both-next-week");
    expect(ids(selectMyEvents(all, "saved", NOW, NOW))).toContain("both-next-week");
  });

  it("mixes going and saved on the past tab, most recent first", () => {
    expect(ids(selectMyEvents(all, "past", NOW, NOW))).toEqual(["yesterday", "last-month"]);
  });

  it("anchors upcoming tabs at the chosen date", () => {
    const anchor = new Date(2026, 7, 12);
    expect(ids(selectMyEvents(all, "going", anchor, NOW))).toEqual([
      "next-week",
      "both-next-week",
    ]);
  });

  it("anchors the past tab backwards from the chosen date", () => {
    const anchor = new Date(2026, 6, 20);
    expect(ids(selectMyEvents(all, "past", anchor, NOW))).toEqual(["last-month"]);
  });
});

describe("anchorRangeForTab / isAnchorAllowed / defaultAnchorForTab", () => {
  const today = new Date(2026, 7, 9);
  const yesterday = new Date(2026, 7, 8);
  const tomorrow = new Date(2026, 7, 10);

  it("lets going and saved reach today and the future only", () => {
    for (const tab of ["going", "saved"] as const) {
      expect(anchorRangeForTab(tab, NOW).min).toEqual(today);
      expect(anchorRangeForTab(tab, NOW).max).toBeNull();

      expect(isAnchorAllowed(today, tab, NOW)).toBe(true);
      expect(isAnchorAllowed(tomorrow, tab, NOW)).toBe(true);
      expect(isAnchorAllowed(yesterday, tab, NOW)).toBe(false);
    }
  });

  it("stops the past tab at yesterday", () => {
    expect(anchorRangeForTab("past", NOW).min).toBeNull();
    expect(anchorRangeForTab("past", NOW).max).toEqual(yesterday);

    expect(isAnchorAllowed(yesterday, "past", NOW)).toBe(true);
    expect(isAnchorAllowed(today, "past", NOW)).toBe(false);
    expect(isAnchorAllowed(tomorrow, "past", NOW)).toBe(false);
  });

  it("meets without overlapping, so no day is reachable from both sides", () => {
    for (const tab of ["going", "saved"] as const) {
      expect(isAnchorAllowed(today, tab, NOW)).toBe(true);
      expect(isAnchorAllowed(today, "past", NOW)).toBe(false);
    }
  });

  it("defaults each tab to the near edge of its own range", () => {
    expect(defaultAnchorForTab("going", NOW)).toEqual(today);
    expect(defaultAnchorForTab("saved", NOW)).toEqual(today);
    expect(defaultAnchorForTab("past", NOW)).toEqual(yesterday);
  });

  it("gives every tab a default its own range allows", () => {
    for (const tab of ["going", "saved", "past"] as const) {
      expect(isAnchorAllowed(defaultAnchorForTab(tab, NOW), tab, NOW)).toBe(true);
    }
  });

  // Mirrors the clamp the page runs when the user switches tabs: keep the
  // anchor if the new tab can reach it, otherwise fall back to its default.
  const clamp = (anchor: Date, next: MyEventsTab) =>
    isAnchorAllowed(anchor, next, NOW) ? anchor : defaultAnchorForTab(next, NOW);

  it("resets a future anchor when switching to past, and back again", () => {
    expect(clamp(tomorrow, "past")).toEqual(yesterday);
    expect(clamp(yesterday, "going")).toEqual(today);
  });

  it("keeps an anchor both upcoming tabs can reach", () => {
    expect(clamp(tomorrow, "saved")).toEqual(tomorrow);
  });

  it("keeps an earlier anchor when staying within past", () => {
    const lastWeek = new Date(2026, 7, 2);
    expect(clamp(lastWeek, "past")).toEqual(lastWeek);
  });
});

describe("myEventStatus", () => {
  it("badges an event you are going to as going, even when it is also saved", () => {
    expect(myEventStatus(bothNextWeek)).toBe("going");
    expect(myEventStatus(nextWeek)).toBe("going");
  });

  it("badges a bookmark you have not committed to as saved", () => {
    expect(myEventStatus(savedNextWeek)).toBe("saved");
  });
});

describe("groupMyEventsByDay", () => {
  it("buckets consecutive events that share a day", () => {
    const groups = groupMyEventsByDay([startedEarlierToday, laterToday, nextWeek]);
    expect(groups).toHaveLength(2);
    expect(ids(groups[0].events)).toEqual(["started-today", "later-today"]);
    expect(ids(groups[1].events)).toEqual(["next-week"]);
  });
});

describe("formatDayLabel", () => {
  it("names the days around today", () => {
    expect(formatDayLabel(new Date(2026, 7, 9, 8, 0), NOW)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 7, 10, 8, 0), NOW)).toBe("Tomorrow");
    expect(formatDayLabel(new Date(2026, 7, 8, 8, 0), NOW)).toBe("Yesterday");
  });

  it("falls back to a weekday and date further out", () => {
    expect(formatDayLabel(new Date(2026, 7, 25), NOW)).toContain("Aug");
  });
});

describe("buildMonthGrid", () => {
  it("returns six full weeks starting on the Sunday before the month", () => {
    const grid = buildMonthGrid(new Date(2026, 7, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(0);
    expect(grid[0]).toEqual(new Date(2026, 6, 26)); // Sun 26 Jul 2026
    expect(grid[41]).toEqual(new Date(2026, 8, 5));
  });
});
