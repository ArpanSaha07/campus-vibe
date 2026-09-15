# ADR-016 — Media URLs carry a hash of their stored key as the last path segment

**Status:** Proposed
**Date:** 2026-09-15
**Decided in:** implementation, after a defect found in the browser — no
meeting note
**Participants:** implementing agent · **Approved by:** awaiting Arpan
**Implemented in:** [`api-and-caching.md`](../architecture/api-and-caching.md),
[`ci-cd-pipeline.md`](../architecture/ci-cd-pipeline.md) — 2026-09-15

## Context

- [ADR-007](ADR-007-uploaded-media-is-streamed-by-the-api.md) addresses stored
  images by index so no caller can name an arbitrary object:
  `/media/events/{id}/images/{index}`, `/media/clubs/{id}/logo`.
- `StoredImageResponses` serves them with `max-age=300, public`
  (`StoredImageResponses.java:64`). Its comment already warned that a long cache
  would pin a replaced image.
- [ADR-015](ADR-015-event-banner-is-the-first-photo.md) made reordering and
  removing photos routine, so a different image appears at the same URL
  immediately, and the browser showed the cached old one for up to five minutes
  ([BUG-056](../../bugs/fixed_bugs.md#bug-056)). A replaced club logo has been
  exposed the same way since 2026-09-09.

## Options considered

### A. A key hash as the last path segment — chosen

`adapters.ts` appends `mediaVersion(key)`, an FNV-1a hash in base 36, and
`next.config.ts` adds a versioned form of each rewrite whose destination ignores
the segment. Every upload writes a unique key, so a URL changes exactly when its
image does. The five-minute cache and ADR-007's index addressing are untouched,
and the key itself never reaches a URL. Costs: three more rewrites, and every
future media route needs both forms.

### B. `?v=<hash>` as a query string

Tried first. `next/image` throws during render on a local `src` with a query
string unless `images.localPatterns` names it
(`next/dist/shared/lib/image-loader.js:55`), so every page with an uploaded image
answered 500. Workable with a `localPatterns` entry allowing any search on
`/media/**` — which Next's own docs warn against — and that entry would then have
to list every other local image path as well.

### C. No caching on image responses

`max-age=0` or `no-cache`: always correct. Every page view then re-fetches every
image through the API, which streams it from S3
([ADR-010](ADR-010-uploads-stream-through-the-api.md)). Rejected on cost.

### D. Address images by key rather than index

Stable per image by construction. Rejected because it undoes ADR-007's reason
for indexes: an endpoint that takes a key from the caller can be pointed at any
object in the bucket.

## Decision

Every media URL the frontend emits ends in a version segment derived from the
stored key, and each `/media` rewrite has a versioned form that ignores it.

## Consequences

- A changed photo or logo appears at once, and caching still works.
- The hash is deterministic on server and client, so `src` agrees across
  hydration.
- A new media route — profile avatars, [BUG-042](../../bugs/bugs.md#bug-042) —
  needs its versioned rewrite or its URLs 404. `rules/frontend.md` carries it.
- Two keys hashing alike would pin a stale image. Over unique UUID keys that is
  negligible, not impossible.

## Revisit when

- Media moves behind a CDN or presigned URLs — ADR-010's triggers — and the URL
  scheme changes wholesale.
- Next changes its rule on query strings for local images.
