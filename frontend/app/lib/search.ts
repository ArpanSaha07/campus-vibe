import { apiFetch } from "@/app/lib/api";
import { toClub, toEventInstance } from "@/app/lib/adapters";
import type { ApiClub, ApiEvent, Club, EventInstance } from "@/app/types";

/** Hybrid (semantic + keyword) event search, ranked by the backend. */
export async function searchEvents(q: string, limit = 20): Promise<EventInstance[]> {
  if (!q.trim()) return [];
  const results = await apiFetch<ApiEvent[]>(
    `/api/v1/events/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`
  );
  return results.map(toEventInstance);
}

/** Hybrid (semantic + keyword) club search, ranked by the backend. */
export async function searchClubs(q: string, limit = 20): Promise<Club[]> {
  if (!q.trim()) return [];
  const results = await apiFetch<ApiClub[]>(
    `/api/v1/clubs/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`
  );
  return results.map(toClub);
}
