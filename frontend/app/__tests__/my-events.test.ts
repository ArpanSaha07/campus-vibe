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

// "Now" is fixed mid-afternoon so the tests can pin the cases end times decide:
// a running event is still upcoming, and one that ended this morning is past.
const NOW = new Date(2026, 7, 9, 15, 0); // Sun 9 Aug 2026, 3:00 PM local
const HOUR = 60 * 60 * 1000;

function myEvent(
  eventId: string,
  dateTime: Date,
  relation: { going?: boolean; saved?: boolean },
  endTime: Date = new Date(dateTime.getTime() + 2 * HOUR),
): MyEvent {
  return {
    going: relation.going ?? false,
    saved: relation.saved ?? false,
    event: { eventId, dateTime, endTime } as EventInstance,
  };
}

const runningNow = myEvent("running-now", new Date(2026, 7, 9, 14, 0), { going: true });
const endedThisMorning = myEvent("ended-this-morning", new Date(2026, 7, 9, 9, 0), { going: true });
const laterToday = myEvent("later-today", new Date(2026, 7, 9, 20, 0), { saved: true });
const nextWeek = myEvent("next-week", new Date(2026, 7, 16, 18, 0), { going: true });
const savedNextWeek = myEvent("saved-next-week", new Date(2026, 7, 17, 18, 0), { saved: true });
const bothNextWeek = myEvent("both-next-week", new Date(2026, 7, 18, 18, 0), {
  going: true,
  saved: true,
});
const yesterday = myEvent("yesterday", new Date(2026, 7, 8, 18, 0), { going: true });
const lastMonth = myEvent("last-month", new Date(2026, 6, 14, 18, 0), { saved: true });
// Began Friday, ends Tuesday: running today, three days after it started.
const festival = myEvent(
  "festival",
  new Date(2026, 7, 7, 10, 0),
  { going: true },
  new Date(2026, 7, 11, 22, 0),
);

const all = [
  runningNow,
  endedThisMorning,
  laterToday,
  nextWeek,
  savedNextWeek,
  bothNextWeek,
  yesterday,
  lastMonth,
  festival,
];

const ids = (events: MyEvent[]) => events.map((item) => item.event.eventId);

describe("isPastEvent", () => {
  it("keeps a running event upcoming until it ends", () => {
    expect(isPastEvent(runningNow.event, NOW)).toBe(false);
    expect(isPastEvent(festival.event, NOW)).toBe(false);
  });

  it("makes an event past the moment it ends, not at midnight", () => {
    expect(isPastEvent(endedThisMorning.event, NOW)).toBe(true);
    const endsNow = myEvent("ends-now", new Date(2026, 7, 9, 13, 0), {}, NOW);
    expect(isPastEvent(endsNow.event, NOW)).toBe(true);
  });
});

describe("selectMyEvents", () => {
  it("keeps running and later events under going, soonest start first", () => {
    expect(ids(selectMyEvents(all, "going", NOW, NOW))).toEqual([
      "festival",
      "running-now",
      "next-week",
      "both-next-week",
    ]);
  });

  it("moves an event that ended this morning to past the same afternoon", () => {
    expect(ids(selectMyEvents(all, "going", NOW, NOW))).not.toContain("ended-this-morning");
    expect(ids(selectMyEvents(all, "past", NOW, NOW))).toContain("ended-this-morning");
    expect(ids(selectMyEvents(all, "past", NOW, NOW))).not.toContain("running-now");
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
    expect(ids(selectMyEvents(all, "past", NOW, NOW))).toEqual([
      "ended-this-morning",
      "yesterday",
      "last-month",
    ]);
  });

  it("anchors upcoming tabs at the chosen date, by the day an event ends", () => {
    // The festival started before the anchor but still runs on it.
    const anchor = new Date(2026, 7, 11);
    expect(ids(selectMyEvents(all, "going", anchor, NOW))).toEqual([
      "festival",
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

  it("stops the past tab at today, which can already hold ended events", () => {
    expect(anchorRangeForTab("past", NOW).min).toBeNull();
    expect(anchorRangeForTab("past", NOW).max).toEqual(today);

    expect(isAnchorAllowed(yesterday, "past", NOW)).toBe(true);
    expect(isAnchorAllowed(today, "past", NOW)).toBe(true);
    expect(isAnchorAllowed(tomorrow, "past", NOW)).toBe(false);
  });

  it("defaults every tab to today", () => {
    expect(defaultAnchorForTab("going", NOW)).toEqual(today);
    expect(defaultAnchorForTab("saved", NOW)).toEqual(today);
    expect(defaultAnchorForTab("past", NOW)).toEqual(today);
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

  it("resets a future anchor when switching to past, and a past one when switching back", () => {
    expect(clamp(tomorrow, "past")).toEqual(today);
    expect(clamp(yesterday, "going")).toEqual(today);
  });

  it("keeps today when switching in either direction", () => {
    expect(clamp(today, "past")).toEqual(today);
    expect(clamp(today, "going")).toEqual(today);
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
    const groups = groupMyEventsByDay([runningNow, laterToday, nextWeek]);
    expect(groups).toHaveLength(2);
    expect(ids(groups[0].events)).toEqual(["running-now", "later-today"]);
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
