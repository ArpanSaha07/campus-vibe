import { apiFetch } from "@/app/lib/api";
import { ApiClub, Club, EventInstance } from "@/app/types";
import { clubs } from "@/app/data/data";
import { toClub } from "@/app/lib/adapters";

export async function getAllClubs(): Promise<Club[]> {
  const apiClubs = await apiFetch<ApiClub[]>(`/api/v1/clubs`);
  return apiClubs.map(toClub);
}

// export async function getClubById(id: string): Promise<Club> {
//   return apiFetch<Club>(`/api/v1/clubs/${id}`);
// }

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
 * @param id The id of the club
 * @returns {Club} The club object or null if not found
 */
export function getClubById(id: string): Club {
    // Simulate fetching a single club by id
    const club = clubs.find(club => club.clubId === id);
    if (!club) {
        throw new Error(`Club with id ${id} not found`)
    }

    return club;
}

/** Display name for a club id; falls back to a title-cased slug for clubs not in mock data. */
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