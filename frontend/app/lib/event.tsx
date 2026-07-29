import { apiFetch } from "@/app/lib/api";
import { toEventInstance } from "@/app/lib/adapters";
import type { ApiEvent, EventInstance } from "@/app/types";

export async function listEvents(): Promise<EventInstance[]> {
	const events = await apiFetch<ApiEvent[]>(`/api/v1/events`);
	return events.map(toEventInstance);
}

export async function getEvent(eventId: string): Promise<EventInstance> {
	const event = await apiFetch<ApiEvent>(`/api/v1/events/${eventId}`);
	return toEventInstance(event);
}

export async function getUserEvents(): Promise<EventInstance[]> {
	return apiFetch<EventInstance[]>(`/api/v1/users/me/events`, { auth: true });
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
