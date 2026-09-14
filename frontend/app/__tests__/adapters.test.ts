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
  topics: ["Games"],
  formats: [],
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
  category: null,
  interests: [],
};

describe("toEventInstance", () => {
  it("maps backend ids and fields to the UI shape", () => {
    const event = toEventInstance(apiEvent);
    expect(event.eventId).toBe("7");
    expect(event.organizer).toBe("chess-club");
    expect(event.dateTime).toBeInstanceOf(Date);
    // Both axes carried through untouched -- the adapter maps shapes, and
    // resolving a slug to a label is the page's job, not this one's.
    expect(event.topics).toEqual(["Games"]);
    expect(event.formats).toEqual([]);
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

  // What the database stores is an S3 object key, which nothing can fetch --
  // handed to next/image it throws "Failed to construct 'URL': Invalid URL".
  // The bucket is private, so the key becomes a same-origin /media path that
  // next.config.ts rewrites to the API endpoint streaming the bytes.
  it("turns a stored S3 key into the media path that serves it", () => {
    const club = toClub({ ...apiClub, logo: "clubs/chess-club/logo-badge.png" });

    expect(club.logo).toBe("/media/clubs/chess-club/logo");
  });

  it("leaves an absolute logo url alone", () => {
    // The demo clubs hold Unsplash urls; those are fetched directly and must
    // not be rewritten to point at an object the bucket does not have.
    const url = "https://images.unsplash.com/photo-123.jpg";

    expect(toClub({ ...apiClub, logo: url }).logo).toBe(url);
  });

  it("addresses banner images by index, passing external urls through", () => {
    const club = toClub({
      ...apiClub,
      images: ["clubs/chess-club/images/one.png", "https://images.unsplash.com/two.jpg"],
    });

    expect(club.images).toEqual([
      "/media/clubs/chess-club/images/0",
      "https://images.unsplash.com/two.jpg",
    ]);
  });
});
