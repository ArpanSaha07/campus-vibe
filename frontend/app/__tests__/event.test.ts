import { ApiError } from "@/app/lib/api";
import { getEvent } from "@/app/lib/event";
import type { ApiEvent } from "@/app/types";

const mockApiFetch = jest.fn();

// ApiError is the real class: the `instanceof` check inside getEvent is exactly
// what these tests are about, and a stubbed error would not exercise it.
jest.mock("@/app/lib/api", () => {
  const actual = jest.requireActual("@/app/lib/api");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const apiEvent: ApiEvent = {
  id: 12,
  title: "Chess Night",
  description: "Bring your own board",
  dateTime: "2026-10-01T18:00:00Z",
  createdAt: "2026-07-01T00:00:00Z",
  location: "BHive Café",
  price: null,
  organizerId: "chess-club",
  followers: 3,
  images: [],
  promoted: false,
  capacity: null,
  registered: 0,
  categories: ["Games"],
};

describe("getEvent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches the event and maps it to the UI shape", async () => {
    mockApiFetch.mockResolvedValue(apiEvent);

    const event = await getEvent("12");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12");
    expect(event?.eventId).toBe("12");
    expect(event?.title).toBe("Chess Night");
    // The organizer is the club id the follow button and club link both need.
    expect(event?.organizer).toBe("chess-club");
  });

  // The distinction the event page depends on: null routes to notFound(), a
  // throw routes to error.tsx.
  it("returns null when no event has that id", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(404, '{"message":"Event with id [99] not found"}'));

    await expect(getEvent("99")).resolves.toBeNull();
  });

  it("rethrows a server error instead of reporting it as missing", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(500, "Internal Server Error"));

    await expect(getEvent("12")).rejects.toThrow(ApiError);
  });

  describe("ids that cannot name an event", () => {
    // Event ids are database bigints. Anything else is answered locally rather
    // than spent on a request the backend can only reject — before this, the
    // slug in the old hardcoded page produced a 500 from a Long path variable
    // that could not convert.
    it.each(["dance-party", "", "12abc", "1.5", "-3", " 12 "])(
      "answers null for %p without calling the API",
      async (id) => {
        await expect(getEvent(id)).resolves.toBeNull();
        expect(mockApiFetch).not.toHaveBeenCalled();
      },
    );

    it("still accepts a plain numeric id", async () => {
      mockApiFetch.mockResolvedValue(apiEvent);

      await expect(getEvent("12")).resolves.not.toBeNull();
      expect(mockApiFetch).toHaveBeenCalled();
    });
  });
});
