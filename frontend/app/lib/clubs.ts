import { Club, EventInstance } from "@/app/types";
// import { clubs } from "./data";

/**
 * Get a club by its id.
 * @param id The id of the club
 * @returns {Club} The club object or null if not found
 */
export async function getClubById(clubs: Club[], id: string): Promise<Club | null> {
    // Simulate fetching a single club by id
    const club = clubs.find(club => club.id === id);
    // if (!club) {
    //     throw new Error(`Club with id ${id} not found`)
    // }

    return club ?? null;
}

function createClubID(name: string): string {
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