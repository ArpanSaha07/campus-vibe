import { apiFetch } from "@/app/lib/api";
import { Club, EventInstance } from "@/app/types";
import { clubs } from "@/app/data/data";

// export async function listClubs(): Promise<Club[]> {
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
    const club = clubs.find(club => club.id === id);
    if (!club) {
        throw new Error(`Club with id ${id} not found`)
    }

    return club;
}

function createClub(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
    
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