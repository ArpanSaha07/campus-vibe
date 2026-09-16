import type {
  ApiClub,
  ApiEvent,
  ApiMyEvent,
  ApiPlannerConversationSummary,
  ApiPlannerMessage,
  ApiPlannerPick,
  ApiPlannerUsage,
  Club,
  EventInstance,
  MyEvent,
  PlannerConversationSummary,
  PlannerMessage,
  PlannerPick,
  PlannerUsage,
} from "@/app/types";

export const FALLBACK_EVENT_IMAGE = "/campus-vibe-logo.png";
export const FALLBACK_CLUB_LOGO = "/campus-vibe-logo.png";

/**
 * Whether a stored image value is already something the browser can fetch.
 *
 * Two different things live in `clubs.logo` and `club_images.url`. The demo
 * data holds absolute Unsplash URLs; anything uploaded through the product
 * holds an S3 **object key** — `clubs/{id}/logos/{uuid}.png`, or
 * `clubs/{id}/logo-{filename}` for one stored before 2026-09-11 — which is not
 * fetchable by anyone and, handed to next/image, throws
 * `Failed to construct 'URL': Invalid URL`.
 *
 * A key is turned into a same-origin `/media/...` path, which `next.config.ts`
 * rewrites to the API endpoint that streams the bytes. The bucket stays
 * private, the frontend never learns the S3 layout, and the path is identical
 * on the server and in the browser -- an absolute API URL could not be, because
 * the two sides reach the backend at different hosts.
 */
function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * A short version tag for a stored key, the last path segment of its media URL.
 *
 * Media URLs name the owner and a position -- `/media/events/3/images/0` -- not
 * the object, so they do not change when the photo behind them does, and the
 * image response may be cached for five minutes. Choosing a new banner or
 * removing a photo moves a *different* photo to the same URL, and the browser
 * kept showing the old one (found 2026-09-15). Every upload gets a unique key,
 * so a tag derived from it changes exactly when the photo does and never
 * otherwise, which keeps the cache useful.
 *
 * A hash rather than the key itself, so the S3 layout still never reaches a
 * URL. FNV-1a: deterministic on server and client alike, so `src` matches
 * across hydration, and no crypto API is needed.
 *
 * A path segment, not `?v=`: next/image refuses a local src with a query string
 * unless `images.localPatterns` names it, and throws during render -- the page
 * answered 500 (found 2026-09-15, the same day). `next.config.ts` rewrites the
 * versioned path to the same API endpoint and ignores the segment.
 */
export function mediaVersion(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * A managed club with its logo made renderable.
 *
 * `ManagedClubDTO.logo` is the stored S3 key, exactly like `ClubDTO.logo`, but
 * the managed-club reads skipped the adapter -- so the dashboard header and the
 * /manage cards received a key, which `ClubLogo` refuses, and a logo uploaded
 * from the club editor never showed in the dashboard it was uploaded from
 * (found 2026-09-15). Same versioned URL as the public club page.
 */
export function toManagedClub(
  api: import("@/app/types").ManagedClub,
): import("@/app/types").ManagedClub {
  return { ...api, logo: clubLogoUrl(api.clubId, api.logo) };
}

/** The API URL that serves a club's logo, or "" when it has none. */
function clubLogoUrl(clubId: string, logo: string | null): string {
  if (!logo || logo.trim() === "") return "";
  if (isAbsoluteUrl(logo)) return logo;
  return `/media/clubs/${encodeURIComponent(clubId)}/logo/${mediaVersion(logo)}`;
}

/**
 * A club's banner images as URLs, in the order the backend returned them.
 *
 * Addressed by index because that is what `GET /clubs/{id}/images/{index}`
 * takes -- deliberately, so that no caller can name an arbitrary object key and
 * have the server fetch it.
 */
function clubImageUrls(clubId: string, images: string[]): string[] {
  return images.map((image, index) =>
    isAbsoluteUrl(image)
      ? image
      : `/media/clubs/${encodeURIComponent(clubId)}/images/${index}/${mediaVersion(image)}`,
  );
}

/**
 * An event's photos as URLs, in the order the backend returned them.
 *
 * The club shape, by index against `GET /events/{id}/images/{index}`. Until
 * 2026-09-12 the stored values were passed through untouched, so an uploaded
 * photo's S3 key reached next/image and threw during render (BUG-042).
 *
 * Unlike club images, a root-relative path passes through too: it points into
 * the frontend's own `public/` folder, which is where the demo data's event
 * pictures live, and next/image accepts it as it is.
 */
function eventImageUrls(eventId: number, images: string[]): string[] {
  return images.map((image, index) =>
    isAbsoluteUrl(image) || image.startsWith("/")
      ? image
      : `/media/events/${encodeURIComponent(String(eventId))}/images/${index}/${mediaVersion(image)}`,
  );
}

/** Maps a backend EventDTO to the EventInstance shape the UI components use. */
export function toEventInstance(api: ApiEvent): EventInstance {
  return {
    eventId: String(api.id),
    title: api.title,
    details: api.description ?? "",
    dateTime: new Date(api.dateTime),
    endTime: new Date(api.endTime),
    createdAt: new Date(api.createdAt),
    location: {
      name: api.location ?? "Location TBA",
      address: "",
      mapUrl: "",
    },
    price: api.price ?? "Free",
    organizer: api.organizerId,
    organizerName: api.organizerName,
    followers: api.followers,
    images: api.images.length > 0 ? eventImageUrls(api.id, api.images) : [FALLBACK_EVENT_IMAGE],
    promoted: api.promoted,
    capacity: api.capacity ?? 0,
    registered: api.registered,
    topics: api.topics,
    formats: api.formats,
  };
}

/** Maps a backend MyEventDTO to the shape the My events page renders. */
export function toMyEvent(api: ApiMyEvent): MyEvent {
  return {
    event: toEventInstance(api.event),
    going: api.going,
    saved: api.saved,
  };
}

/** Maps a backend ClubDTO to the Club shape the UI components use. */
export function toClub(api: ApiClub): Club {
  return {
    clubId: api.id,
    name: api.name,
    description: api.description ?? "",
    followers: api.followers,
    // Empty, not a placeholder path: <ClubLogo> turns this into the club's
    // initial. See the note at the top of this file.
    logo: clubLogoUrl(api.id, api.logo),
    socialLinks: parseSocialLinks(api.socialLinks),
    featured: api.featured,
    images: clubImageUrls(api.id, api.images),
    createdAt: new Date(api.createdAt),
    category: api.category,
    interests: api.interests,
  };
}

/**
 * The JSON string in `clubs.social_links` as an object.
 *
 * Exported because a club proposal carries the same string, and the admin queue
 * reads it before any club exists — so this is not only `toClub`'s business any
 * more. Shape translation belongs here rather than in a component.
 */
export function parseSocialLinks(raw: string | null): Club["socialLinks"] {
  if (!raw) return { email: "" };
  try {
    const parsed = JSON.parse(raw);
    return { email: "", ...parsed };
  } catch {
    return { email: "" };
  }
}

/**
 * A planner answer's picks, joined to the cards the server hydrated for them.
 *
 * A pick with no card is dropped: the event was deleted or has ended since the
 * answer was written, and the server leaves it out rather than send a stale
 * card. Only picks of the first pick's kind are kept, so an answer can never
 * render more than one card row even if a reply mixes the two.
 */
export function toPlannerPicks(
  picks: ApiPlannerPick[],
  events: ApiEvent[],
  clubs: ApiClub[],
): PlannerPick[] {
  const kind = picks[0]?.kind;
  const eventsById = new Map(events.map((e) => [String(e.id), e]));
  const clubsById = new Map(clubs.map((c) => [c.id, c]));
  const hydrated: PlannerPick[] = [];
  for (const pick of picks) {
    if (pick.kind !== kind) continue;
    if (pick.kind === "event") {
      const event = eventsById.get(pick.id);
      if (event) hydrated.push({ kind: "event", reason: pick.reason, event: toEventInstance(event) });
    } else {
      const club = clubsById.get(pick.id);
      if (club) hydrated.push({ kind: "club", reason: pick.reason, club: toClub(club) });
    }
  }
  return hydrated;
}

export function toPlannerMessage(api: ApiPlannerMessage): PlannerMessage {
  return {
    id: api.id,
    role: api.role,
    content: api.content,
    status: api.status,
    picks: api.role === "assistant" ? toPlannerPicks(api.picks, api.events, api.clubs) : [],
  };
}

export function toPlannerConversationSummary(
  api: ApiPlannerConversationSummary,
): PlannerConversationSummary {
  return { id: api.id, title: api.title, lastActiveAt: new Date(api.lastActiveAt) };
}

export function toPlannerUsage(api: ApiPlannerUsage): PlannerUsage {
  return { used: api.used, limit: api.limit, resetsAt: new Date(api.resetsAt) };
}
