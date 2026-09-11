---
name: s3-media
description: CampusVibe media on S3 — club logos, event banners and profile images. Use when touching the s3 package, an image upload or delete endpoint, an object key, bucket config, or AWS credentials for media. Covers the private-bucket presigned model and where the code departs from it.
paths:
  - "backend/src/main/java/com/campusvibe/s3/**"
  - "backend/src/main/resources/application*.yml"
  - "docker/**"
---

# S3 media

[`reference.md`](reference.md) is the full security model — 38 sections, the
plan of record. This is the part you need in your head before touching the code,
plus the honest gap between the two.

## The model

- **The bucket stays private.** Public access blocked, ACLs disabled, bucket
  owner enforced, SSE-S3. Browsers reach media through **presigned URLs only**.
  Never make it public, never add a `public-read` ACL or a public bucket policy,
  however much easier it makes displaying an image (§6, §17).
- **The backend generates every object key.** `clubs/{id}/logos/{uuid}.webp`,
  `events/{id}/banners/{uuid}.webp`, `users/{id}/profiles/{uuid}.webp`. A client
  never supplies a key, and a user-supplied filename is never the canonical
  object name (§7, §13).
- **Authorise before you presign.** A presigned URL is a capability — once it
  exists the check is over. `POST /events/381/banner/upload-url` must confirm the
  event exists, belongs to club X, and that the caller can manage club X, all
  before the URL is minted. Never trust an id from the client (§10).
- **Validate:** `image/jpeg`, `image/png`, `image/webp`, 5 MB. Do not trust the
  browser's filename, extension or `Content-Type` on their own (§12).
- **Lifetimes:** uploads ~10 minutes, reads ~30. Store the **object key** in
  PostgreSQL and mint the URL when returning data — never persist a presigned
  URL (§8, §11, §16).
- **Replace in this order:** upload new, confirm, update the database, *then*
  delete the old object. Deleting first means a failed upload leaves a broken
  image (§19).
- **Deletes are explicit.** Deleting a club or event must delete its objects;
  never list the bucket to find them when the keys are already in Postgres (§20).
- **S3 and PostgreSQL are not one transaction.** Plan for the half that fails
  (§21).
- **Credentials come from the environment, never the code.** Production uses the
  instance IAM role through the default provider chain
  (`S3Config.java:23-25`, `application-prod.yml:23-25`).

## What is actually built today

Read this before quoting `reference.md` at the code — much of it is not
implemented, and the reference does not say so.

- **There is no presigning at all.** `S3Service.java` has three methods,
  `putObject`, `getObject` and `deleteObject`, all moving raw bytes through the
  backend. Every presigned-URL rule above describes work that has not started;
  deciding it is the next unit, as its own ADR.
- **Reading is done by streaming through the API, and only for clubs.**
  `GET /api/v1/clubs/{id}/logo` and `/images/{index}`
  (`ClubController.java:141`, `:158`) are the only read path that exists;
  `getObject` had no caller at all before 2026-09-09. Chosen over presigned or
  public URLs because `FakeS3` cannot presign and no bucket or CDN is
  provisioned to be public with — Arpan, 2026-09-09. **Event banners and
  profile avatars still have none**, so an uploaded event image cannot be
  displayed.
- **Images are addressed by index, never by key.** An endpoint that took a key
  from the caller would fetch any object in the bucket it was pointed at. The
  index is resolved against that club's own list.
- **An uploaded SVG is never served as `image/svg+xml`.** `imageTypeOf`
  (`ClubController.java:207`) names raster types only and falls back to
  `application/octet-stream`, with `nosniff`. Uploads refuse SVG since
  2026-09-11, but objects stored before then were never checked, and an SVG is
  a document that can carry script — serving one as an image would execute it on
  the API's origin. It stays as the second line of defence. Do not add svg to
  that map.
- **A stored key is not a URL, and the frontend must never render one.** That is
  what [BUG-040](../../bugs/fixed_bugs.md#bug-040) was: the key reached
  `next/image`, which throws at render time rather than failing to load, so the
  page came down. `adapters.ts` maps keys onto `/media/...` and
  `next.config.ts` rewrites that to the API.
- **`aws.s3.mock` swaps the client, and it is on everywhere but `prod`.** True
  by default (`application.yml:52`, `docker-compose.yml:116`, the CI Docker
  job), so `S3Config.java:18-26` hands back `FakeS3`, which writes to
  `~/.arpan/s3` on the local disk — `/root/.arpan/s3` in the dev compose
  container, which runs as root (`backend/Dockerfile` sets no `USER`; the EB
  image runs as `campusvibe`). `application-prod.yml` sets it false.
- **`FakeS3` is not S3 in the one way that matters.** S3 treats a key as an
  opaque string, so `..` in one is two characters. `FakeS3` joins the key onto
  a directory, where `..` climbs. `buildObjectFullPath` therefore refuses any
  key that resolves outside its bucket's directory, on put, get and delete
  ([BUG-039](../../bugs/fixed_bugs.md#bug-039)). Never reason about a key's
  safety from real S3's semantics alone.
- **Two buckets, not one.** `S3Buckets.java` exposes `clubs` and `events`
  (`application.yml:53-55`); the reference assumes a single bucket with prefixes,
  and nothing exists for profile images.
- **The backend generates every key — `s3/MediaKeys` and nothing else.** Since
  2026-09-11 ([BUG-039](../../bugs/fixed_bugs.md#bug-039)), in the §7 layout:
  `clubs/{id}/logos/{uuid}.{ext}`, `clubs/{id}/images/{uuid}.{ext}`,
  `events/{id}/banners/{uuid}.{ext}`. Nothing reads `getOriginalFilename()`.
  Keys written before then keep the old `clubs/{id}/logo-{filename}` shape and
  still read; nothing migrated them.
- **Validated by content, not by label.** `MediaKeys` reads the leading bytes
  and accepts PNG, JPEG and WebP only (§12); the filename and the part's
  `Content-Type` are ignored, since the caller writes both. Anything else, and
  an empty file, is a 400. A multi-file upload is checked in full before any
  file is stored. There is no re-encoding to WebP (§14).
- **5MB per file, 10MB per request** (`application.yml:34-35`), per §12. Over
  either is a 413 with a sentence (`DefaultExceptionHandler`). MockMvc never
  applies these caps; only `MediaUploadLimitIT`, on a real port, sees them.
- **A replaced logo's old object is deleted, in §19's order**: store the new
  object, point the row at it, and delete the old one only after
  `ClubService.updateLogo` has committed. A failed delete is logged and does not
  fail the request, and only a key `MediaKeys.belongsToClub` recognises as that
  club's own is ever deleted — never a seeded Unsplash URL. An upload whose
  database write fails orphans its new object (§21, accepted). Banner images
  have no delete endpoint, so nothing deletes them, and nothing deletes a
  club's or event's objects when the row goes (§20).

## Before you change any of this

Moving to presigned uploads is a decision, not an oversight to fix in passing:
it changes the frontend, the endpoints and possibly the stored keys at once, and
ADR-007 rejected presigning for *reads* because `FakeS3` cannot presign. It is
queued as its own ADR in [`todo.md`](../../TODO/todo.md) and
[`decisions/README.md`](../../docs/decisions/README.md). Ask Arpan rather than
riding it on another feature.

**Building the missing event and avatar read paths** should follow the club one
above rather than inventing a second shape — same index addressing, same
content-type restriction, same `/media/**` rewrite. If that ever stops scaling,
the replacement is presigned or CDN URLs for *all* media at once, which is an
ADR, not a per-feature choice.
