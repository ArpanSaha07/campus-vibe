import { FALLBACK_EVENT_IMAGE, toClub, toEventInstance } from "@/app/lib/adapters";
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
  organizerName: "Chess Club",
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

  // Carried through rather than derived. Cards used to title-case the slug,
  // which only ever agreed with the real name by coincidence.
  it("carries the organizer name alongside its id", () => {
    const event = toEventInstance({
      ...apiEvent,
      organizerId: "mcgill-ski-club",
      organizerName: "McGill Ski Club",
    });
    expect(event.organizer).toBe("mcgill-ski-club");
    expect(event.organizerName).toBe("McGill Ski Club");
  });

  // The case the old title-casing got wrong: a name that is not its slug with
  // capitals. Title-casing would have produced 'Mcgill Ski Club' here, and
  // anything genuinely unrelated to its slug was hopeless.
  it("keeps a name that does not match its slug", () => {
    const event = toEventInstance({
      ...apiEvent,
      organizerId: "startup-montreal",
      organizerName: "Making Waves Montreal",
    });
    expect(event.organizerName).toBe("Making Waves Montreal");
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

  // Empty rather than a placeholder image: <ClubLogo> reads this as "no logo"
  // and renders the club's initial instead.
  it("leaves a missing logo empty for ClubLogo to fall back on", () => {
    expect(toClub(apiClub).logo).toBe("");
  });
});
