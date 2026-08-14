import { apiFetch } from "@/app/lib/api";
import { toEventInstance, toMyEvent } from "@/app/lib/adapters";
import type { ApiEvent, ApiMyEvent, EventInstance, MyEvent } from "@/app/types";

export async function listEvents(): Promise<EventInstance[]> {
	const events = await apiFetch<ApiEvent[]>(`/api/v1/events`);
	return events.map(toEventInstance);
}

export async function getEvent(eventId: string): Promise<EventInstance> {
	const event = await apiFetch<ApiEvent>(`/api/v1/events/${eventId}`);
	return toEventInstance(event);
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
