import { ApiError } from "@/app/lib/api";
import {
  deleteEvent,
  deleteEventImage,
  setEventBanner,
  getEvent,
  getEventForEdit,
  updateEvent,
  uploadEventImages,
} from "@/app/lib/event";
import { PUBLIC_READ_CACHE } from "@/app/lib/cache";
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
  organizerName: "Chess Club",
  followers: 3,
  images: [],
  promoted: false,
  capacity: null,
  registered: 0,
  topics: ["Games"],
  formats: [],
};

describe("editing an event", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the raw event without the public cache, so null fields stay null", async () => {
    mockApiFetch.mockResolvedValue(apiEvent);

    const raw = await getEventForEdit("12");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12", { auth: true });
    // Not "Free", "Location TBA" or 0 -- those would be saved back as real values.
    expect(raw?.price).toBeNull();
    expect(raw?.capacity).toBeNull();
  });

  it("answers null for an event that does not exist", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(404, "{}"));
    await expect(getEventForEdit("99")).resolves.toBeNull();
  });

  it("sends a full replacement, emptied fields as null", async () => {
    mockApiFetch.mockResolvedValue(apiEvent);

    await updateEvent("12", {
      title: "Chess Night",
      description: "  ",
      dateTime: "2026-10-01T18:00:00.000Z",
      location: "",
      price: "",
      capacity: null,
      topics: ["games"],
      formats: [],
    });

    const [path, init] = mockApiFetch.mock.calls[0];
    expect(path).toBe("/api/v1/events/12");
    expect(init.method).toBe("PUT");
    expect(init.auth).toBe(true);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ description: null, location: null, price: null, capacity: null });
    expect(body).not.toHaveProperty("organizerId");
  });

  it("deletes with auth", async () => {
    mockApiFetch.mockResolvedValue(undefined);
    await deleteEvent("12");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12", {
      method: "DELETE",
      auth: true,
    });
  });

  it("uploads photos as multipart under the part name files, and skips an empty pick", async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await uploadEventImages("12", []);
    expect(mockApiFetch).not.toHaveBeenCalled();

    const file = new File(["x"], "a.png", { type: "image/png" });
    await uploadEventImages("12", [file]);
    const [path, init] = mockApiFetch.mock.calls[0];
    expect(path).toBe("/api/v1/events/12/images");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).getAll("files")).toHaveLength(1);
  });
});

describe("managing an event's photos", () => {
  beforeEach(() => jest.clearAllMocks());

  // By position, never by key: the server resolves the index against this
  // event's own list, so no caller can name another object.
  it("removes a photo by position and returns the event as it now stands", async () => {
    mockApiFetch.mockResolvedValue({ ...apiEvent, images: [] });

    const next = await deleteEventImage("12", 3);

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12/images/3", {
      method: "DELETE",
      auth: true,
    });
    expect(next.images).toEqual([]);
  });

  it("chooses the banner by position", async () => {
    mockApiFetch.mockResolvedValue(apiEvent);

    await setEventBanner("12", 2);

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12/images/2/banner", {
      method: "PUT",
      auth: true,
    });
  });
});

describe("getEvent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches the event and maps it to the UI shape", async () => {
    mockApiFetch.mockResolvedValue(apiEvent);

    const event = await getEvent("12");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/events/12", PUBLIC_READ_CACHE.events);
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
