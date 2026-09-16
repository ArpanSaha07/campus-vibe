import {
  formatEventDateLong,
  formatEventDateRange,
  formatEventDateShort,
  formatEventMonthDay,
  formatEventTime,
  formatEventWeekday,
  fromEventInputValue,
  toEventInputValue,
} from "@/app/lib/event-zone";
import { formatEventDateTime } from "@/app/lib/my-events";

// Every expectation here is Montreal time, whatever zone the machine running
// the suite is in: the zone is pinned inside the formatters, not read from the
// process. 19:00Z in September is 3:00 PM EDT; 20:00Z in December is 3:00 PM EST.
const september = new Date("2026-09-17T19:00:00Z");
const december = new Date("2026-12-17T20:00:00Z");

describe("event formatters", () => {
  it("prints Montreal clock time in summer and in winter", () => {
    expect(formatEventTime(september)).toBe("3:00 PM");
    expect(formatEventTime(december)).toBe("3:00 PM");
  });

  it("prints the Montreal date, not the UTC one, late in the evening", () => {
    // 02:30Z on Sep 18 is still 10:30 PM on Sep 17 in Montreal.
    const lateEvening = new Date("2026-09-18T02:30:00Z");
    expect(formatEventDateShort(lateEvening)).toBe("Thu, Sep 17");
    expect(formatEventMonthDay(lateEvening)).toBe("Sep 17");
    expect(formatEventWeekday(lateEvening)).toBe("Thu");
    expect(formatEventDateLong(lateEvening)).toBe("Thursday, September 17, 2026");
  });

  it("never names a zone", () => {
    const printed = [
      formatEventTime(september),
      formatEventTime(december),
      formatEventDateLong(september),
      formatEventDateTime(september),
      formatEventDateRange(september, new Date("2026-09-20T19:00:00Z")),
    ].join(" ");
    expect(printed).not.toMatch(/UTC|GMT|EDT|EST|ET\b/);
    expect(formatEventDateTime(september)).toBe("Thu, Sep 17 · 3:00 PM");
  });

  it("prints a range, or one date when both ends fall on the same day", () => {
    expect(formatEventDateRange(september, new Date("2026-09-20T19:00:00Z"))).toMatch(
      /^Thu, Sep 17\s*–\s*Sun, Sep 20$/,
    );
    expect(formatEventDateRange(september, new Date("2026-09-17T23:00:00Z"))).toBe("Thu, Sep 17");
  });
});

describe("toEventInputValue / fromEventInputValue", () => {
  it("round-trips a form value through the instant it names", () => {
    const instant = fromEventInputValue("2026-10-01T18:00");
    expect(instant?.toISOString()).toBe("2026-10-01T22:00:00.000Z");
    expect(toEventInputValue(instant!)).toBe("2026-10-01T18:00");
  });

  it("reads winter values with the winter offset", () => {
    expect(fromEventInputValue("2026-12-17T15:00")?.toISOString()).toBe("2026-12-17T20:00:00.000Z");
  });

  it("shows a stored instant as its Montreal clock time in the form", () => {
    expect(toEventInputValue(new Date("2026-09-18T02:30:00Z"))).toBe("2026-09-17T22:30");
  });

  it("takes the first occurrence of a repeated autumn hour", () => {
    // Clocks fall back at 2:00 AM on Nov 1 2026, so 1:30 AM happens twice.
    expect(fromEventInputValue("2026-11-01T01:30")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("resolves a time in the skipped spring hour instead of throwing", () => {
    // Clocks jump from 2:00 to 3:00 AM on Mar 8 2026; 2:30 AM never happens.
    const instant = fromEventInputValue("2026-03-08T02:30");
    expect(instant).not.toBeNull();
    expect(["01:30", "03:30"]).toContain(toEventInputValue(instant!).slice(11));
  });

  it("answers null for an empty or malformed value", () => {
    expect(fromEventInputValue("")).toBeNull();
    expect(fromEventInputValue("not a date")).toBeNull();
    expect(fromEventInputValue("2026-10-01")).toBeNull();
  });
});
