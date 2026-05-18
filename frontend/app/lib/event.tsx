import { apiFetch } from "@/app/lib/api";
import type { EventInstance } from "@/app/types";

export async function listEvents(): Promise<EventInstance[]> {
	return apiFetch<EventInstance[]>(`/api/v1/events`);
}

export async function getEvent(eventId: string): Promise<EventInstance> {
	return apiFetch<EventInstance>(`/api/v1/events/${eventId}`);
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