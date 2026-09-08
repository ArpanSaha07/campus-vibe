import { apiFetch } from "@/app/lib/api";
import type { ClubCategory, EventFormat, Interest } from "@/app/types";

/**
 * The three vocabularies: student interests, club categories, event formats.
 *
 * All three are public, identical for every caller, and change only when a
 * migration runs — so unlike anything per-user they are safe to cache, and
 * cached hard. An hour is arbitrary but the wrong answer costs a stale label,
 * not a wrong permission.
 *
 * Fetched rather than hardcoded because slugs are what get stored and this is
 * the only place that knows what each one is called. A second copy in the
 * frontend would be two lists that must agree with nothing checking that they
 * do — which is the failure `contracts/api-dto-fields.json` exists to prevent,
 * and it should not be reintroduced one directory over.
 */
const VOCABULARY_CACHE = { revalidate: 3600 } as const;

/**
 * Every interest **and** every group, in picker order.
 *
 * Groups come through with a null `parentSlug`. They are in the same list
 * because an event may be tagged with either, and because a picker needs them
 * to render its headings.
 */
export async function getInterests(): Promise<Interest[]> {
  return apiFetch<Interest[]>("/api/v1/interests", VOCABULARY_CACHE);
}

export async function getClubCategories(): Promise<ClubCategory[]> {
  return apiFetch<ClubCategory[]>("/api/v1/club-categories", VOCABULARY_CACHE);
}

export async function getEventFormats(): Promise<EventFormat[]> {
  return apiFetch<EventFormat[]>("/api/v1/event-formats", VOCABULARY_CACHE);
}

/**
 * Slug to label, for turning stored slugs back into words.
 *
 * A slug that is not in the vocabulary is left as-is rather than dropped: it
 * means the entry was retired after something was tagged with it, and showing
 * `ai-machine-learning` is poor but showing nothing is worse — it hides that
 * the tag is there at all.
 */
export function labelFor(
  vocabulary: { slug: string; label: string }[],
  slug: string,
): string {
  return vocabulary.find((entry) => entry.slug === slug)?.label ?? slug;
}
