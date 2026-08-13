import { apiFetch, ApiError } from "@/app/lib/api";
import { ApiClub, Club, EventInstance } from "@/app/types";
import { clubs } from "@/app/data/data";
import { toClub } from "@/app/lib/adapters";

export async function getAllClubs(): Promise<Club[]> {
  const apiClubs = await apiFetch<ApiClub[]>(`/api/v1/clubs`);
  return apiClubs.map(toClub);
}

/**
 * Clubs the signed-in user follows, for the My clubs page and for the Follow
 * buttons scattered across the club grids.
 *
 * Already sorted by name server-side, so the grid does not reshuffle between
 * loads.
 */
export async function getMyClubs(): Promise<Club[]> {
    const apiClubs = await apiFetch<ApiClub[]>(`/api/v1/users/me/clubs`, { auth: true });
    return apiClubs.map(toClub);
}

// export function getAllClubs(): Club[] {
//     // Simulate fetching clubs from an API
//     return clubs;
// }

/**
 * Get a club by its id.
 *
 * `null` means the club does not exist, and is not an error: any slug can be
 * typed into the address bar, so a miss is an ordinary outcome of a URL the
 * user chose. Anything else — a 500, a dropped connection, a backend that is
 * down — still throws, because that is a genuine failure the caller cannot
 * render its way out of. The club page relies on exactly that split: `null`
 * reaches `notFound()`, a throw reaches `error.tsx`.
 *
 * @param id The id (slug) of the club
 * @returns The club, or null if no club has that id
 */
export async function getClubById(id: string): Promise<Club | null> {
    try {
        const apiClub = await apiFetch<ApiClub>(`/api/v1/clubs/${encodeURIComponent(id)}`);
        return toClub(apiClub);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
    }
}

/**
 * Display name for a club id; falls back to a title-cased slug for clubs not in
 * mock data.
 *
 * TODO: still reads mock data, so it title-cases the slug for every real club.
 * Harmless where it is used — three client-side display sites, and the fallback
 * is legible — but it should follow `getClubById` onto the API.
 */
export function getClubNameById(id: string): string {
    const club = clubs.find(club => club.clubId === id);
    if (club) return club.name;
    return id
        .split("-")
        .map(word => (word ? word[0].toUpperCase() + word.slice(1) : word))
        .join(" ");
}

export async function createClub(name: string): Promise<string> {
    const club_name: string = name.trim().toLowerCase().replace(/\s+/g, '-');
    // return name.trim().toLowerCase().replace(/\s+/g, '-');
    return apiFetch<string>(`/api/v1/clubs`, { method: "POST", body: JSON.stringify({ club_name }) });
}

/** 
 * Get total events for a club by club Id.
 * @param {Club} clubId The name of the club
 * @returns {number} Total number of events for the club
*/
export function getTotalEventsForClub(clubId: string): number {
    
    return Math.floor(Math.random() * 100); // Random number for demo
}

function getEventsByClubId(clubId: string): EventInstance[] {
    return [];
}

// export async function isUserFollowingClub(clubId: string): Promise<boolean> {
//     const user: RegularUser = await me();
//     if (!isRegularUser(user)) return false;
//     return user.followedClubs.includes(clubId);
// }

// Follow state is keyed off the JWT, never off a user id in the path — the
// backend reads the acting user from the token, so these take only a club id.

export async function followClub(clubId: string): Promise<void> {
    await apiFetch<void>(`/api/v1/users/me/followed-clubs`, {
        method: "POST",
        body: JSON.stringify({ clubId }),
        auth: true,
    });
}

export async function unfollowClub(clubId: string): Promise<void> {
    await apiFetch<void>(`/api/v1/users/me/followed-clubs/${encodeURIComponent(clubId)}`, {
        method: "DELETE",
        auth: true,
    });
}