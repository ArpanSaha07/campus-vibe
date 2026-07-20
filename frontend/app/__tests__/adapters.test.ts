import {
  FALLBACK_CLUB_LOGO,
  FALLBACK_EVENT_IMAGE,
  toClub,
  toEventInstance,
} from "@/app/lib/adapters";
import type { ApiClub, ApiEvent } from "@/app/types";

const apiEvent: ApiEvent = {
  id: 7,
  title: "Chess Night",
  description: null,
  dateTime: "2026-08-01T18:00:00Z",
  createdAt: "2026-07-01T00:00:00Z",
  location: null,
  price: null,
  organizerId: "chess-club",
  followers: 3,
  images: [],
  promoted: false,
  capacity: null,
  registered: 0,
  categories: ["Games"],
};

const apiClub: ApiClub = {
  id: "chess-club",
  name: "Chess Club",
  description: null,
  followers: 45,
  logo: null,
  socialLinks: '{"email":"chess@campus.com","instagram":"@chess"}',
  featured: false,
  images: [],
  createdAt: "2026-07-01T00:00:00Z",
};

describe("toEventInstance", () => {
  it("maps backend ids and fields to the UI shape", () => {
    const event = toEventInstance(apiEvent);
    expect(event.eventId).toBe("7");
    expect(event.organizer).toBe("chess-club");
    expect(event.dateTime).toBeInstanceOf(Date);
    expect(event.categories).toEqual(["Games"]);
  });

  it("provides safe fallbacks for nullable fields", () => {
    const event = toEventInstance(apiEvent);
    expect(event.images).toEqual([FALLBACK_EVENT_IMAGE]);
    expect(event.price).toBe("Free");
    expect(event.location.name).toBe("Location TBA");
    expect(event.capacity).toBe(0);
    expect(event.details).toBe("");
  });

  it("keeps real images when present", () => {
    const event = toEventInstance({ ...apiEvent, images: ["/a.jpg"] });
    expect(event.images).toEqual(["/a.jpg"]);
  });
});

describe("toClub", () => {
  it("parses the socialLinks JSON string", () => {
    const club = toClub(apiClub);
    expect(club.clubId).toBe("chess-club");
    expect(club.socialLinks.email).toBe("chess@campus.com");
    expect(club.socialLinks.instagram).toBe("@chess");
  });

  it("survives malformed or missing socialLinks", () => {
    expect(toClub({ ...apiClub, socialLinks: "not-json" }).socialLinks).toEqual({ email: "" });
    expect(toClub({ ...apiClub, socialLinks: null }).socialLinks).toEqual({ email: "" });
  });

  it("falls back to the default logo", () => {
    expect(toClub(apiClub).logo).toBe(FALLBACK_CLUB_LOGO);
  });
});
