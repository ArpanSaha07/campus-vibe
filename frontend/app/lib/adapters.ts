import type { ApiClub, ApiEvent, ApiMyEvent, Club, EventInstance, MyEvent } from "@/app/types";

export const FALLBACK_EVENT_IMAGE = "/campus-vibe-logo.png";
export const FALLBACK_CLUB_LOGO = "/campus-vibe-logo.png";

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
    categories: api.categories,
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
    logo: api.logo ?? "",
    socialLinks: parseSocialLinks(api.socialLinks),
    featured: api.featured,
    images: api.images,
    createdAt: new Date(api.createdAt),
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
