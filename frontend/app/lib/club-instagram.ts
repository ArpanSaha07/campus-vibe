import { apiFetch } from "@/app/lib/api";
import type { ClubInstagram } from "@/app/types";

/**
 * The club dashboard's Instagram section: `/api/v1/clubs/{id}/instagram`.
 *
 * The handle is the same value as the Instagram field on the Edit Club page —
 * the server stores it once, in the club's contact links.
 */

export async function getClubInstagram(clubId: string): Promise<ClubInstagram> {
  return apiFetch<ClubInstagram>(`/api/v1/clubs/${encodeURIComponent(clubId)}/instagram`, {
    auth: true,
  });
}

/** Saves the handle and the auto-import choice. A blank handle disconnects the account. */
export async function updateClubInstagram(
  clubId: string,
  body: { handle: string; autoImport?: boolean },
): Promise<ClubInstagram> {
  return apiFetch<ClubInstagram>(`/api/v1/clubs/${encodeURIComponent(clubId)}/instagram`, {
    method: "PUT",
    body: JSON.stringify(body),
    auth: true,
  });
}

/** Starts an import of this club's account. 429 inside the cooldown, 409 while any run is going. */
export async function importClubInstagramNow(clubId: string): Promise<ClubInstagram> {
  return apiFetch<ClubInstagram>(`/api/v1/clubs/${encodeURIComponent(clubId)}/instagram/import`, {
    method: "POST",
    auth: true,
  });
}

/** What the user typed, as a bare handle: no @, no instagram.com prefix. Display only; the server decides. */
export function toHandleInput(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}
