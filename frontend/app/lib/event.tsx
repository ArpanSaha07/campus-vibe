import { apiFetch } from "@/app/lib/api";
import type { EventInstance } from "@/app/types";

export async function listEvents(): Promise<EventInstance[]> {
	return apiFetch<EventInstance[]>(`/api/v1/events`);
}

export async function getEvent(id: number): Promise<EventInstance> {
	return apiFetch<EventInstance>(`/api/v1/events/${id}`);
}

export async function getUserEvents(): Promise<EventInstance[]> {
	return apiFetch<EventInstance[]>(`/api/v1/users/me/events`, { auth: true });
}

