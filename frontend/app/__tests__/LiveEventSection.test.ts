import { popular, tagged } from "@/app/components/main-page/LiveEventSection";
import type { EventInstance } from "@/app/types";

jest.mock("next/server", () => ({ connection: jest.fn() }));
jest.mock("@/app/lib/event", () => ({ listUpcomingEvents: jest.fn() }));

function event(id: string, iso: string, formats: string[] = [], topics: string[] = []): EventInstance {
  return {
    eventId: id,
    title: id,
    details: "",
    dateTime: new Date(iso),
    endTime: new Date(new Date(iso).getTime() + 2 * 3600_000),
    createdAt: new Date(iso),
    location: { name: "", address: "", mapUrl: "" },
    price: "",
    organizer: "club",
    organizerName: "Club",
    followers: 0,
    images: [],
    promoted: false,
    capacity: 0,
    registered: 0,
    topics,
    formats,
    sourceUrl: null,
  };
}

describe("homepage rows", () => {
  // Wednesday 25 November 2026, noon in Montreal.
  const now = new Date("2026-11-25T17:00:00Z").getTime();

  it("puts this weekend's events first in Popular this weekend, then the soonest", () => {
    const thursday = event("thu", "2026-11-26T23:00:00Z");
    const saturday = event("sat", "2026-11-28T23:00:00Z");
    const nextSaturday = event("next-sat", "2026-12-05T23:00:00Z");

    expect(popular([thursday, saturday, nextSaturday], now).map((e) => e.eventId)).toEqual(["sat", "thu", "next-sat"]);
  });

  it("reads Montreal's weekday, not UTC's", () => {
    // 01:00 UTC Saturday is Friday evening in Montreal: still the weekend.
    const fridayNight = event("fri-night", "2026-11-28T01:00:00Z");
    const thursday = event("thu", "2026-11-26T23:00:00Z");

    expect(popular([thursday, fridayNight], now)[0].eventId).toBe("fri-night");
  });

  it("matches workshops and outdoor events by their tags", () => {
    expect(tagged(event("w", "2026-11-26T23:00:00Z", ["workshop"]), ["workshop"])).toBe(true);
    expect(tagged(event("h", "2026-11-26T23:00:00Z", [], ["hiking"]), ["outdoors", "hiking"])).toBe(true);
    expect(tagged(event("p", "2026-11-26T23:00:00Z", ["party"]), ["workshop"])).toBe(false);
  });
});
