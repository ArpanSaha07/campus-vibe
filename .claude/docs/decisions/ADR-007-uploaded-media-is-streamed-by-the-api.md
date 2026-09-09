# ADR-007 — Uploaded media is streamed by the API, not handed out as an S3 URL

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-09
**Raised by:** [BUG-040](../../bugs/fixed_bugs.md#bug-040) — an uploaded club
logo took the whole `/clubs` page down. Decided by Arpan on 2026-09-09, during
the club-governance work.
**Approved by:** — (pending)
**Implemented in:** `ClubController.logo` / `.image`, `adapters.ts`,
`next.config.ts` — shipped 2026-09-09 for clubs only.

## Context

`ClubController.uploadLogo` stores an S3 object **key** —
`clubs/{id}/logo-{filename}` — in `clubs.logo`, and `ClubDTO` handed it to the
browser untouched. A key is not fetchable by anyone.

Nothing noticed for as long as nothing could upload: before the club-governance
work, creating a club granted the creator no authority over it, so the logo
control was collected and deliberately discarded and `clubs.logo` was NULL for
every club. Wiring the upload made the gap immediate, and the failure was worse
than a broken image — `next/image` throws `Failed to construct 'URL': Invalid
URL` **during render**, which no `onError` can catch, so one club with a logo
took down the whole clubs grid.

This is not only a club problem. `events.images` holds keys the same way, and
`ProfileAvatar` records that avatars have no upload at all. **There has never
been a read path for S3 media anywhere in this codebase** —
`S3Service.getObject` existed with no caller.

Two constraints shape the answer. `aws.s3.mock` is true by default, so locally
the client is `FakeS3`, a filesystem stub writing to `~/.arpan/s3`. And none of
the AWS infrastructure is provisioned — no bucket policy, no CloudFront.

## Options considered

### A. Presigned GET URLs on the DTO

The standard answer: the backend signs a time-limited S3 URL and the browser
fetches S3 directly, so the bytes never touch the app server.

Rejected for now. `FakeS3` implements `S3Client` over the local filesystem and
cannot presign, so local development would need a second code path — and a media
path that is not exercised locally is one that breaks in production. The
expiry also interacts badly with caching: `/clubs` is held for five minutes,
so a cached page can outlive the URLs embedded in it.

### B. A public bucket behind a CDN

Cheapest at scale, and the usual end state. Rejected as premature: it needs a
bucket and CloudFront that do not exist, it makes every uploaded image
world-readable by URL, and the frontend would need the base URL through
`NEXT_PUBLIC_*`, which ships empty in the production image
([BUG-004](../../bugs/bugs.md#bug-004)).

### C. Stream the bytes through the API — chosen

`GET /api/v1/clubs/{id}/logo` and `/images/{index}` read the object with
`S3Service.getObject` and return it. Identical behaviour against `FakeS3` and
real S3, bucket stays private, nothing to provision.

The cost is real and should be named: every image byte goes through the app
server, there is no CDN, and caching is ours to add — currently a five-minute
`Cache-Control`.

## Decision

Uploaded media is served by the API. Two rules go with it, both load-bearing
rather than incidental:

1. **Images are addressed by index, never by key.** An endpoint taking a key
   from the caller would fetch any object in the bucket it was pointed at. The
   index is resolved against that club's own list.
2. **Only raster content types are named; everything else, an SVG included, is
   served `application/octet-stream` with `nosniff`.** Nothing validates what is
   uploaded ([BUG-039](../../bugs/bugs.md#bug-039)), and an SVG is a document
   that can carry script — serving one as `image/svg+xml` would execute it on
   the API's origin.

The frontend addresses it through a **same-origin `/media/**` path** rewritten
in `next.config.ts` to `API_INTERNAL_URL`, rather than an absolute API URL.
That is not cosmetic; an absolute URL fails three ways at once. Next 16 refuses
to optimize an upstream image whose host resolves to a private IP, which local
development always is. The optimizer runs server-side, where `localhost:8080` is
the frontend container rather than the backend. And emitting the internal URL on
the server and the public one in the browser would be a hydration mismatch on
`src`. The rewrite is evaluated at request time, so unlike `NEXT_PUBLIC_*` it is
not subject to BUG-004.

## Consequences

**Easier.** Media works identically in every environment, with no S3
configuration a developer has to hold. The bucket stays private, so a leaked key
name grants nothing. `next/image` sees a local path, so `remotePatterns` stays
down to Unsplash and no SSRF escape hatch is enabled.

**Harder.** Image bytes go through the app server and count against its
throughput, and there is no CDN in front. Each new media kind needs its own
endpoint — this is why the shape above is written down rather than left to be
re-derived.

**Foreclosed.** Nothing here scales to large media. This is a decision for club
logos and banners at their current size, not a media platform.

**Not done.** Only clubs have it. Event banners and avatars still have no read
path ([BUG-042](../../bugs/bugs.md#bug-042)) — latent only because no UI uploads
them yet.

## Revisit when

- Image traffic is a measurable share of backend load, or a page's images are a
  measurable share of its time. That is the trigger for option B, and by then
  the bucket and CDN will exist for other reasons.
- Media grows past logos and banners — video, or original-resolution photos —
  at which point streaming through the app server stops being defensible.
- A second media kind is built. If events and avatars each end up with a
  hand-rolled endpoint, the three want one generic media controller instead.
