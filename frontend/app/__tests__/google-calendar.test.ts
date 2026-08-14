import { buildGoogleCalendarUrl } from "@/app/lib/google-calendar";
import type { EventInstance } from "@/app/types";

const event = {
  eventId: "tech-conf",
  title: "Tech Conference",
  details: "Doors at 1:30 PM. Bring student ID.",
  dateTime: new Date("2026-10-15T14:00:00Z"),
  location: {
    name: "Trottier Building",
    address: "3630 University St, Montreal",
    mapUrl: "",
  },
} as EventInstance;

const url = (overrides: Partial<EventInstance> = {}, options = {}) =>
  buildGoogleCalendarUrl({ ...event, ...overrides } as EventInstance, "ACME Corp", options);

describe("buildGoogleCalendarUrl", () => {
  it("titles the event 'title | club' with the pipe encoded as %7C", () => {
    expect(url()).toContain("text=Tech%20Conference%20%7C%20ACME%20Corp");
  });

  it("stamps start and end as basic-format UTC, two hours apart by default", () => {
    expect(url()).toContain("dates=20261015T140000Z/20261015T160000Z");
  });

  it("honours an explicit duration", () => {
    expect(url({}, { durationMs: 60 * 60 * 1000 })).toContain(
      "dates=20261015T140000Z/20261015T150000Z",
    );
  });

  it("sends venue name and address as one location", () => {
    expect(url()).toContain(
      "location=Trottier%20Building%2C%203630%20University%20St%2C%20Montreal",
    );
  });

  it("carries the description as details", () => {
    expect(url()).toContain("details=Doors%20at%201%3A30%20PM.%20Bring%20student%20ID.");
  });

  it("omits details entirely when the event has none", () => {
    expect(url({ details: "" })).not.toContain("details=");
  });

  it("omits ctz unless a caller asks for one", () => {
    expect(url()).not.toContain("ctz=");
    expect(url({}, { timeZone: "America/New_York" })).toContain("ctz=America%2FNew_York");
  });

  it("never encodes a space as '+', which not every client decodes", () => {
    expect(url()).not.toContain("+");
  });

  it("points at the Google Calendar template action", () => {
    expect(url()).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
  });
});
