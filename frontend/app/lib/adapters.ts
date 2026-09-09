import type { ApiClub, ApiEvent, ApiMyEvent, Club, EventInstance, MyEvent } from "@/app/types";

export const FALLBACK_EVENT_IMAGE = "/campus-vibe-logo.png";
export const FALLBACK_CLUB_LOGO = "/campus-vibe-logo.png";

/**
 * Whether a stored image value is already something the browser can fetch.
 *
 * Two different things live in `clubs.logo` and `club_images.url`. The demo
 * data holds absolute Unsplash URLs; anything uploaded through the product
 * holds an S3 **object key** — `clubs/{id}/logo-{filename}` — which is not
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

/** The API URL that serves a club's logo, or "" when it has none. */
function clubLogoUrl(clubId: string, logo: string | null): string {
  if (!logo || logo.trim() === "") return "";
  if (isAbsoluteUrl(logo)) return logo;
  return `/media/clubs/${encodeURIComponent(clubId)}/logo`;
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
      : `/media/clubs/${encodeURIComponent(clubId)}/images/${index}`,
  );
}

/** Maps a backend EventDTO to the EventInstance shape the UI components use. */
export function toEventInstance(api: ApiEvent): EventInstance {
  return {
    eventId: String(api.id),
    title: api.title,
    details: api.description ?? "",
    dateTime: new Date(api.dateTime),
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
    images: api.images.length > 0 ? api.images : [FALLBACK_EVENT_IMAGE],
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

function parseSocialLinks(raw: string | null): Club["socialLinks"] {
  if (!raw) return { email: "" };
  try {
    const parsed = JSON.parse(raw);
    return { email: "", ...parsed };
  } catch {
    return { email: "" };
  }
}
