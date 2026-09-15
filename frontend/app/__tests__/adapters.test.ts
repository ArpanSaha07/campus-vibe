import {
  FALLBACK_EVENT_IMAGE,
  mediaVersion,
  toClub,
  toEventInstance,
  toManagedClub,
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

  // An uploaded photo is stored as an S3 object key, which next/image throws on
  // during render -- the club logo crash, for events (BUG-042). Addressed by
  // position, so a key written under the old banners/ prefix maps the same way.
  it("turns stored S3 keys into the media paths that serve them, by index", () => {
    const event = toEventInstance({
      ...apiEvent,
      images: [
        "events/7/images/one.png",
        "https://images.unsplash.com/two.jpg",
        "/banners/fta.jpg",
        "events/7/banners/old.png",
      ],
    });

    expect(event.images).toEqual([
      `/media/events/7/images/0/${mediaVersion("events/7/images/one.png")}`,
      "https://images.unsplash.com/two.jpg",
      "/banners/fta.jpg",
      `/media/events/7/images/3/${mediaVersion("events/7/banners/old.png")}`,
    ]);
  });

  // Found 2026-09-15: choosing a new banner moved a different photo to
  // /images/0, and the browser's cached copy of that URL kept showing the old
  // banner. The version tag must change with the photo, and only with it.
  it("gives a photo a new URL when a different photo takes its position", () => {
    const before = toEventInstance({
      ...apiEvent,
      images: ["events/7/images/blue.png", "events/7/images/red.png"],
    });
    const afterReorder = toEventInstance({
      ...apiEvent,
      images: ["events/7/images/red.png", "events/7/images/blue.png"],
    });
    const unchanged = toEventInstance({
      ...apiEvent,
      images: ["events/7/images/blue.png", "events/7/images/red.png"],
    });

    expect(afterReorder.images[0]).not.toBe(before.images[0]);
    expect(afterReorder.images[1]).not.toBe(before.images[1]);
    // The same photo in the same place keeps its URL, so the cache still works.
    expect(unchanged.images).toEqual(before.images);
  });
});

describe("toManagedClub", () => {
  const managed = {
    clubId: "chess-club",
    clubName: "Chess Club",
    logo: null as string | null,
    followers: 3,
    role: "CLUB_OWNER" as const,
    officialEmail: null,
    officialEmailVerified: false,
  };

  // The managed-club reads used to hand ClubLogo the raw S3 key, which it
  // refuses, so an uploaded logo never showed in the dashboard header.
  it("turns a stored logo key into the same versioned media path as the club page", () => {
    const key = "clubs/chess-club/logos/abc.png";
    const club = toManagedClub({ ...managed, logo: key });

    expect(club.logo).toBe(`/media/clubs/chess-club/logo/${mediaVersion(key)}`);
    // No query string: next/image throws on one for a local src (found 2026-09-15).
    expect(club.logo).not.toContain("?");
    expect(club.logo).toBe(toClub({ ...apiClub, id: "chess-club", logo: key }).logo);
  });

  it("passes an absolute logo through and leaves a missing one empty", () => {
    const url = "https://images.unsplash.com/photo-123.jpg";
    expect(toManagedClub({ ...managed, logo: url }).logo).toBe(url);
    expect(toManagedClub({ ...managed, logo: null }).logo).toBe("");
  });

  it("keeps every other field as the server sent it", () => {
    const club = toManagedClub({ ...managed, logo: "clubs/chess-club/logos/abc.png" });
    expect({ ...club, logo: null }).toEqual(managed);
  });
});

describe("mediaVersion", () => {
  it("is stable for a key, differs between keys, and never exposes the key", () => {
    const key = "events/7/images/0f3c.png";
    expect(mediaVersion(key)).toBe(mediaVersion(key));
    expect(mediaVersion(key)).not.toBe(mediaVersion("events/7/images/9a1b.png"));
    expect(mediaVersion(key)).toMatch(/^[0-9a-z]+$/);
    expect(mediaVersion(key)).not.toContain("events");
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

    // Versioned by key, so a replaced logo is a new URL rather than a cached old one.
    expect(club.logo).toBe(
      `/media/clubs/chess-club/logo/${mediaVersion("clubs/chess-club/logo-badge.png")}`,
    );
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
      `/media/clubs/chess-club/images/0/${mediaVersion("clubs/chess-club/images/one.png")}`,
      "https://images.unsplash.com/two.jpg",
    ]);
  });
});
