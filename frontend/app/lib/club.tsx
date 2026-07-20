import { apiFetch } from "@/app/lib/api";
import { Club, EventInstance, RegularUser } from "@/app/types";
import { clubs } from "@/app/data/data";
import { me } from "@/app/lib/user";

// export async function getAllClubs(): Promise<Club[]> {
//   return apiFetch<Club[]>(`/api/v1/clubs`);
// }

// export async function getClubById(id: string): Promise<Club> {
//   return apiFetch<Club>(`/api/v1/clubs/${id}`);
// }

export function getAllClubs(): Club[] {
    // Simulate fetching clubs from an API
    return clubs;
}

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

export async function followClub(clubId: string): Promise<void> {
    // Simulate following a club (e.g., API call)
    console.log(`Followed club with id: ${clubId}`);


}