"use server";

import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/app/lib/cache";

/**
 * Drops the cached clubs list.
 *
 * `PUBLIC_READ_CACHE.clubs` holds `GET /api/v1/clubs` for five minutes, which is
 * right for a list that changes a few times a day and wrong for the moment
 * somebody has just created a club: without this the admin creates a club,
 * lands on it, goes back to `/clubs` and does not see it for up to five
 * minutes. `cache.ts` says every entry carries a tag so a future mutation can do
 * exactly this — this is that caller.
 *
 * `updateTag`, not `revalidateTag`. This is a read-your-own-writes case: the
 * person who just created the club is the one about to look at the list, so the
 * next request must wait for fresh data rather than being served the stale
 * entry that `revalidateTag`'s stale-while-revalidate semantics would hand
 * back. `updateTag` can only be called from a Server Action, which is what this
 * file is — see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md.
 *
 * A server action rather than a plain function for the same reason: the two
 * callers are client components — the create form, and approving a proposal on
 * the admin dashboard.
 */
export async function revalidateClubs(): Promise<void> {
  updateTag(CACHE_TAGS.clubs);
}
