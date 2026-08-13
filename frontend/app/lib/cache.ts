/**
 * Cache policy for the public reads, in one place.
 *
 * `fetch` is uncached by default in this version of Next, so without these a
 * server-rendered page re-queries the backend on every request — including the
 * club and event lists, which change a few times a day at most.
 *
 * Only genuinely public data belongs here. Anything fetched with `auth: true`
 * is per-user and must never enter the shared data cache; `apiFetch` throws if
 * the two are combined rather than trusting this comment.
 *
 * The TTL is a floor, not a promise: the tags let a future create/edit call
 * `revalidateTag('clubs')` and drop the entry immediately instead of waiting.
 * That is why every entry carries one even though nothing revalidates yet.
 */

/** Long enough to absorb a burst of traffic, short enough that a stale list self-heals. */
const FIVE_MINUTES = 300;

export const CACHE_TAGS = {
  clubs: "clubs",
  events: "events",
} as const;

export const PUBLIC_READ_CACHE = {
  clubs: { revalidate: FIVE_MINUTES, tags: [CACHE_TAGS.clubs] },
  events: { revalidate: FIVE_MINUTES, tags: [CACHE_TAGS.events] },
} as const;

// Search is deliberately absent. Its query space is unbounded, so caching it
// fills the store with entries that will never be asked for twice, and results
// are ranked per query rather than being a stable resource.
