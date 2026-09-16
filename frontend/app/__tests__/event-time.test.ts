import {
  DEFAULT_EVENT_LENGTH_MS,
  eventTimesError,
  hasEnded,
  isOngoing,
  shiftLocalDateTime,
} from "@/app/lib/event-time";

const NOW = new Date("2026-09-16T22:00:00Z");
const at = (iso: string) => new Date(iso);

describe("hasEnded / isOngoing", () => {
  it("calls an event that has started and not ended ongoing", () => {
    const event = { dateTime: at("2026-09-16T21:00:00Z"), endTime: at("2026-09-16T23:00:00Z") };
    expect(isOngoing(event, NOW)).toBe(true);
    expect(hasEnded(event, NOW)).toBe(false);
  });

  it("calls an event that has not started neither ongoing nor ended", () => {
    const event = { dateTime: at("2026-09-17T18:00:00Z"), endTime: at("2026-09-17T20:00:00Z") };
    expect(isOngoing(event, NOW)).toBe(false);
    expect(hasEnded(event, NOW)).toBe(false);
  });

  it("calls an event ended from the instant its end passes", () => {
    const event = { dateTime: at("2026-09-16T20:00:00Z"), endTime: NOW };
    expect(hasEnded(event, NOW)).toBe(true);
    expect(isOngoing(event, NOW)).toBe(false);
  });

  // The check this replaced compared UTC calendar dates, so at 6 PM in
  // Montreal (22:00 UTC) an event from that morning still read as today.
  it("does not badge a morning event that is already over", () => {
    const event = { dateTime: at("2026-09-16T13:00:00Z"), endTime: at("2026-09-16T15:00:00Z") };
    expect(isOngoing(event, NOW)).toBe(false);
  });
});

describe("shiftLocalDateTime", () => {
  it("moves a datetime-local value by two hours in local time", () => {
    expect(shiftLocalDateTime("2026-09-01T18:00", DEFAULT_EVENT_LENGTH_MS)).toBe("2026-09-01T20:00");
  });

  it("rolls over midnight", () => {
    expect(shiftLocalDateTime("2026-09-01T23:30", DEFAULT_EVENT_LENGTH_MS)).toBe("2026-09-02T01:30");
  });

  it("answers empty for an empty or invalid value", () => {
    expect(shiftLocalDateTime("", DEFAULT_EVENT_LENGTH_MS)).toBe("");
    expect(shiftLocalDateTime("not a date", DEFAULT_EVENT_LENGTH_MS)).toBe("");
  });
});

describe("eventTimesError", () => {
  it("accepts an end after the start", () => {
    expect(eventTimesError("2026-09-01T18:00", "2026-09-01T20:00")).toBe("");
  });

  it("says nothing while either value is missing", () => {
    expect(eventTimesError("2026-09-01T18:00", "")).toBe("");
    expect(eventTimesError("", "2026-09-01T20:00")).toBe("");
  });

  it("refuses an end at or before the start", () => {
    expect(eventTimesError("2026-09-01T18:00", "2026-09-01T18:00")).toMatch(/end after it starts/);
    expect(eventTimesError("2026-09-01T18:00", "2026-09-01T17:00")).toMatch(/end after it starts/);
  });

  it("allows exactly 14 days and refuses a minute more", () => {
    expect(eventTimesError("2026-09-01T18:00", "2026-09-15T18:00")).toBe("");
    expect(eventTimesError("2026-09-01T18:00", "2026-09-15T18:01")).toMatch(/14 days/);
  });
});
