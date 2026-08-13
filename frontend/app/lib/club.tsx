import { apiFetch, ApiError } from "@/app/lib/api";
import { ApiClub, Club } from "@/app/types";
import { toClub } from "@/app/lib/adapters";
import { PUBLIC_READ_CACHE } from "@/app/lib/cache";
import { listEventsByClub } from "@/app/lib/event";

export async function getAllClubs(): Promise<Club[]> {
  const apiClubs = await apiFetch<ApiClub[]>(`/api/v1/clubs`, PUBLIC_READ_CACHE.clubs);
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
        const apiClub = await apiFetch<ApiClub>(
            `/api/v1/clubs/${encodeURIComponent(id)}`,
            PUBLIC_READ_CACHE.clubs,
        );
        return toClub(apiClub);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
    }
}

// getClubNameById used to live here: it looked a club up in mock data and, on a
// miss, title-cased the slug. That guess was right for the seeded clubs only by
// coincidence — `chess-club` happens to title-case to `Chess Club` — and wrong
// for anything with an acronym, a lowercase particle, or a name that is not
// just its slug with capitals. EventDTO now carries organizerName, so the three
// call sites read it off the event instead of deriving it.

export async function createClub(name: string): Promise<string> {
    const club_name: string = name.trim().toLowerCase().replace(/\s+/g, '-');
    // return name.trim().toLowerCase().replace(/\s+/g, '-');
    return apiFetch<string>(`/api/v1/clubs`, { method: "POST", body: JSON.stringify({ club_name }) });
}

/**
 * How many events a club has run.
 *
 * Previously `Math.floor(Math.random() * 100)`, so the club page printed a
 * different total on every load. Now counted from the club's own events, which
 * the events endpoint filters server-side.
 */
export async function getTotalEventsForClub(clubId: string): Promise<number> {
    const events = await listEventsByClub(clubId);
    return events.length;
}

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