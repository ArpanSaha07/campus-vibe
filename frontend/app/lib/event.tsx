import { apiFetch, ApiError } from "@/app/lib/api";
import { toEventInstance, toMyEvent } from "@/app/lib/adapters";
import { PUBLIC_READ_CACHE } from "@/app/lib/cache";
import type { ApiEvent, ApiMyEvent, EventInstance, MyEvent } from "@/app/types";

export async function listEvents(): Promise<EventInstance[]> {
	const events = await apiFetch<ApiEvent[]>(`/api/v1/events`, PUBLIC_READ_CACHE.events);
	return events.map(toEventInstance);
}

/**
 * One club's events, filtered by the backend.
 *
 * The club dashboard used to fetch every event in the system and filter it in
 * the browser, which meant downloading the whole table to show one club's rows.
 */
export async function listEventsByClub(clubId: string): Promise<EventInstance[]> {
	const events = await apiFetch<ApiEvent[]>(
		`/api/v1/events?organizerId=${encodeURIComponent(clubId)}`,
		PUBLIC_READ_CACHE.events,
	);
	return events.map(toEventInstance);
}

/**
 * Get an event by its id.
 *
 * `null` means no such event, and is not an error — any id can be typed into
 * the address bar. Anything else still throws, so a 500 or an unreachable
 * backend stays an exception. The event page depends on that split: `null`
 * reaches notFound(), a throw reaches error.tsx. Mirrors getClubById.
 */
export async function getEvent(eventId: string): Promise<EventInstance | null> {
	// Event ids are database bigints. A slug or anything else cannot name one,
	// so it is answered here rather than spent on a request the backend would
	// reject as a type mismatch anyway.
	if (!/^\d+$/.test(eventId)) return null;

	try {
		const event = await apiFetch<ApiEvent>(
			`/api/v1/events/${eventId}`,
			PUBLIC_READ_CACHE.events,
		);
		return toEventInstance(event);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
}

/**
 * The signed-in user's saved + going events, for the My events page.
 *
 * One request serves all three tabs: the response carries each event plus the
 * user's relationship to it, so Going / Saved / Past are split client-side.
 */
export async function getMyEvents(): Promise<MyEvent[]> {
	const myEvents = await apiFetch<ApiMyEvent[]>(`/api/v1/users/me/events`, { auth: true });
	return myEvents.map(toMyEvent);
}

export async function saveEvent(eventId: string): Promise<void> {
	await apiFetch(`/api/v1/users/me/saved-events`, {
		method: "POST",
		body: JSON.stringify({ eventId }),
		auth: true,
	});
}

export function unsaveEvent(eventId: string): Promise<void> {
	return apiFetch(`/api/v1/users/me/saved-events/${eventId}`, {
		method: "DELETE",
		auth: true,
	});
}

/** What the create-event form collects. Mirrors the backend EventCreateRequest. */
export interface NewEvent {
  title: string;
  description: string;
  /** ISO-8601. The form collects `datetime-local`, which has no zone. */
  dateTime: string;
  /** ISO-8601, after dateTime and at most 14 days later. Required. */
  endTime: string;
  location: string;
  price: string;
  /** The club putting it on — you must be able to manage it. */
  organizerId: string;
  capacity: number | null;
  /** `interest_catalogue` slugs: what the event is about. */
  topics: string[];
  /** `event_formats` slugs: what kind of thing it is. */
  formats: string[];
}

/**
 * Creates an event and returns it.
 *
 * Authorisation is club-scoped rather than role-based: the backend checks
 * `canManageClub(organizerId)`, so the form must only offer clubs the signed-in
 * user actually manages. A 403 here means the club select offered something it
 * should not have.
 */
export async function createEvent(event: NewEvent): Promise<EventInstance> {
  const created = await apiFetch<ApiEvent>("/api/v1/events", {
    method: "POST",
    body: JSON.stringify({
      ...event,
      description: event.description.trim() || null,
      location: event.location.trim() || null,
      price: event.price.trim() || null,
    }),
    auth: true,
  });
  return toEventInstance(created);
}

/** What the edit form sends: everything but the club, which an event cannot change. */
export type EventFields = Omit<NewEvent, "organizerId">;

/**
 * An event exactly as the API holds it, bypassing Next's data cache.
 *
 * For the edit form, which must not go through `toEventInstance`: that turns a
 * null location into "Location TBA", a null price into "Free" and a null
 * capacity into 0 — display values that would be saved back as real ones.
 * `null` means no such event, as with `getEvent`.
 */
export async function getEventForEdit(eventId: string): Promise<ApiEvent | null> {
  if (!/^\d+$/.test(eventId)) return null;
  try {
    return await apiFetch<ApiEvent>(`/api/v1/events/${eventId}`, { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Edits an event. `PUT /api/v1/events/{id}`, guarded by `canManageEvent`.
 *
 * Full replacement: an emptied description, location or price is sent as null
 * and clears the stored value, and so does an emptied capacity.
 */
export async function updateEvent(eventId: string, event: EventFields): Promise<EventInstance> {
  const updated = await apiFetch<ApiEvent>(`/api/v1/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...event,
      description: event.description.trim() || null,
      location: event.location.trim() || null,
      price: event.price.trim() || null,
    }),
    auth: true,
  });
  return toEventInstance(updated);
}

/**
 * Deletes an event. A hard delete: its RSVPs and bookmarks go with it, which
 * the caller must say before asking (CEM-14 is not built).
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/events/${eventId}`, { method: "DELETE", auth: true });
}

/**
 * Adds photos to an event. Multipart, part name `files`, matching
 * `EventController.uploadImages`; `apiFetch` leaves `Content-Type` to the
 * browser, which is the only thing that knows the boundary.
 *
 * Add-only: there is no endpoint that removes one. The first photo an event has
 * is the banner on its page.
 */
/** The most photos one event may hold, enforced by the backend too. */
export const MAX_EVENT_PHOTOS = 10;

/**
 * Removes one of an event's photos by its position, and returns the event as it
 * now stands. Positions shift afterwards, so the caller redraws from the result.
 */
export async function deleteEventImage(eventId: string, index: number): Promise<ApiEvent> {
  return apiFetch<ApiEvent>(`/api/v1/events/${eventId}/images/${index}`, {
    method: "DELETE",
    auth: true,
  });
}

/**
 * Makes one photo the event's banner by moving it to the first position — every
 * surface already draws the first photo as the banner, so the order *is* the
 * choice. Returns the event as it now stands.
 */
export async function setEventBanner(eventId: string, index: number): Promise<ApiEvent> {
  return apiFetch<ApiEvent>(`/api/v1/events/${eventId}/images/${index}/banner`, {
    method: "PUT",
    auth: true,
  });
}

export async function uploadEventImages(eventId: string, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  await apiFetch<void>(`/api/v1/events/${eventId}/images`, {
    method: "POST",
    body,
    auth: true,
  });
}
