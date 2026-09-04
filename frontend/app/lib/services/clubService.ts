import { ApiError, apiFetch } from "@/app/lib/api";
import { toClub } from "@/app/lib/adapters";
import type { ApiClub, Club } from "@/app/types";

/**
 * Creating a club.
 *
 * <strong>This file used to call endpoints that do not exist.</strong> It
 * fetched `/api/clubs/check-name` and `/api/clubs/create` — relative paths, no
 * version prefix — and there are no Next route handlers in this app, so both
 * were 404s. Club creation has never worked from the UI. It now goes through
 * `apiFetch` to the real backend, like every other domain module.
 *
 * The multipart half is not here, and that is not an oversight. See
 * `createClub` below.
 */

/**
 * The id a club will get, derived from its name.
 *
 * `Club.id` is a slug and the backend takes it from the request rather than
 * generating one, so the client has to decide it. Kept beside the name check
 * because the two have to agree: checking availability of anything other than
 * the id that will actually be used answers a different question.
 */
export function clubSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whether a club already holds the slug this name would take.
 *
 * A 404 is the answer, not an error — it is how the backend says *nothing here*.
 * Deliberately uncached: this runs as somebody types, and a stale yes would let
 * two people both believe a name was free.
 *
 * A network failure resolves to `false` rather than throwing. Blocking a form on
 * an availability check that could not run would be worse than letting it
 * through: the backend answers 409 on the real create, which is the check that
 * actually decides.
 */
export async function checkClubNameExists(clubName: string): Promise<boolean> {
  const slug = clubSlug(clubName);
  if (!slug) return false;

  try {
    await apiFetch<ApiClub>(`/api/v1/clubs/${encodeURIComponent(slug)}`);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    return false;
  }
}

export interface NewClub {
  name: string;
  description: string;
  /** A `club_categories` slug. */
  category: string | null;
  /** `interest_catalogue` slugs — at most eight, enforced server-side too. */
  interests: string[];
}

/**
 * Creates the club and returns it.
 *
 * <strong>Logo, banner images and social links are not sent, and cannot be.</strong>
 * All three are written by endpoints guarded by `canManageClub`, and creating a
 * club does not make you its owner — ownership arrives only when a platform
 * admin approves a club-admin request. So a creator who tried to upload a logo
 * in the same breath would get a 403.
 *
 * Silently dropping the files the form collected would be worse than not
 * offering them, so the caller is told; see the club-creation items in
 * `todo.md`. Category and interests ride on the create request itself for
 * exactly this reason — they are the only descriptive fields a creator can
 * actually set.
 */
export async function createClub(club: NewClub): Promise<Club> {
  const created = await apiFetch<ApiClub>("/api/v1/clubs", {
    method: "POST",
    body: JSON.stringify({
      id: clubSlug(club.name),
      name: club.name.trim(),
      description: club.description.trim(),
      category: club.category,
      interests: club.interests,
    }),
    auth: true,
  });
  return toClub(created);
}
