---
name: s3-media
description: CampusVibe media on S3 — club logos and images, event photos and profile images. Use when touching the s3 package, an image upload or delete endpoint, an object key, bucket config, or AWS credentials for media. Covers the private-bucket presigned model and where the code departs from it.
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
  owner enforced, SSE-S3. Never make it public, never add a `public-read` ACL or
  a public bucket policy, however much easier it makes displaying an image (§6,
  §17). Where the reference says browsers reach media through *presigned URLs
  only*, read ADR-007 and ADR-010 instead: they reach it through the API, and
  the bucket stays exactly as private.
- **The backend generates every object key.** `clubs/{id}/logos/{uuid}.webp`,
  `events/{id}/images/{uuid}.webp`, `users/{id}/profiles/{uuid}.webp`. **There is
  no banner prefix** — Arpan, 2026-09-12: a banner is one of an event's photos
  — since 2026-09-15 the first one, chosen by the club and live on the event
  page ([ADR-015](../../docs/decisions/ADR-015-event-banner-is-the-first-photo.md))
  — not a stored kind. Where
  `reference.md` says `banners/`, read `images/`. A client
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

- **There is no presigning at all, and that is now a decision rather than a
  gap.** `S3Service.java` has three methods, `putObject`, `getObject` and
  `deleteObject`, all moving raw bytes through the backend. Uploads stream in
  ([ADR-010](../../docs/decisions/ADR-010-uploads-stream-through-the-api.md)) and
  reads stream out ([ADR-007](../../docs/decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md)).
  **`reference.md` §9 describes the rejected option** — presigning would hand S3
  whatever the browser sends, so the content sniffing that is the whole BUG-039
  fix could not run before the object lands. Do not open work to close it.
- **Reading is done by streaming through the API, for clubs and events.**
  `GET /api/v1/clubs/{id}/logo`, `/clubs/{id}/images/{index}` and, since
  2026-09-12, `/events/{id}/images/{index}`. All three hand the key to
  **`s3/StoredImageResponses`**, the one place the response is built. **Profile
  avatars still have no read path** ([BUG-042](../../bugs/bugs.md#bug-042)).
- **Images are addressed by index, never by key.** An endpoint that took a key
  from the caller would fetch any object in the bucket it was pointed at. The
  index is resolved against that club's or event's own list. A stored value that
  is not a key — an absolute URL or a root-relative path — is a 404 before the
  store is asked. **Because a position is not an object, every media URL the
  frontend emits ends in a hash of the stored key** — reordering or removing a
  photo moves a different image to the same index, and the response is cached
  for five minutes ([ADR-016](../../docs/decisions/ADR-016-media-urls-versioned-by-key-hash.md)).
- **An uploaded SVG is never served as `image/svg+xml`.** `imageTypeOf`
  (`StoredImageResponses.java`) names raster types only and falls back to
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
- **The client is always a real `S3Client`. There is no mock flag.**
  `aws.s3.mock` and the filesystem stub behind it were deleted on 2026-09-12
  ([ADR-011](../../docs/decisions/ADR-011-minio-replaces-fakes3.md)) — the flag
  defaulted to true, so the branch production uses had *never executed anywhere*,
  which is how BUG-039 and BUG-051 both arrived. What varies now is only where
  the client points: `aws.s3.endpoint` set means **MinIO** (local, CI and the
  media ITs, through `MinioTestContainer`); unset means AWS, with credentials
  from the default provider chain. MinIO comes from **quay.io, not Docker Hub** —
  `docker pull minio/minio` is refused outright.
- **One bucket, not two** ([ADR-012](../../docs/decisions/ADR-012-one-media-bucket-with-prefixes.md)).
  `MediaBucket` reads `aws.s3.bucket` from `AWS_S3_BUCKET`, which has **no
  default and rejects a blank value**, so an environment that does not name its
  bucket fails to start. Media kinds are separated by key prefix, which is what
  `MediaKeys` was already writing. `S3Buckets`, with its `clubs` and `events`
  properties, is gone.
- **Key safety is ours, not the store's.** `MediaKeys.assertSafeKey` refuses a
  key that is absolute, or has a `.` or `..` segment, a backslash, a `//` or a
  scheme, and `S3Service` applies it to every put, get and delete. The deleted
  stub used to carry this because it joined the key onto a directory; MinIO and
  S3 both treat a key as an opaque string and would accept all of it. **That is
  the reason to keep the check, not to drop it** (BUG-039).
- **The backend generates every key — `s3/MediaKeys` and nothing else.** Since
  2026-09-11 ([BUG-039](../../bugs/fixed_bugs.md#bug-039)), in the §7 layout:
  `clubs/{id}/logos/{uuid}.{ext}`, `clubs/{id}/images/{uuid}.{ext}`,
  `events/{id}/images/{uuid}.{ext}`. Nothing reads `getOriginalFilename()`.
  Keys written before then keep the old `clubs/{id}/logo-{filename}` shape, and
  event photos uploaded before 2026-09-12 keep `events/{id}/banners/`; both still
  read, and nothing migrated them.
- **Validated by content, not by label.** `MediaKeys` reads the leading bytes
  and accepts PNG, JPEG and WebP only (§12); the filename and the part's
  `Content-Type` are ignored, since the caller writes both. Anything else, and
  an empty file, is a 400. A multi-file upload is checked in full before any
  file is stored. There is no re-encoding to WebP (§14).
- **5MB per file, 10MB per request** (`application.yml:34-35`), per §12. Over
  either is a 413 with a sentence (`DefaultExceptionHandler`). MockMvc never
  applies these caps; only `MediaUploadLimitIT`, on a real port, sees them.
  **In production nginx sits in front and refuses 1 MB by default**, which
  `deploy/eb/.platform/nginx/conf.d/client_max_body_size.conf` raises to `10M`.
  Change it together with `max-request-size`.
- **A missing object is a 404, not a 500.** `S3Service.getObject` translates
  `NoSuchKeyException` into `ResourceNotFoundException`. A row pointing at an
  object that is not there is a real state — §21's accepted orphan — rather than
  a server fault. **In production that depends on the instance role holding
  `s3:ListBucket`**: without it S3 answers a missing key with 403, not
  NoSuchKey, and the read is a 500. MinIO always lists, so no test shows it.
- **A replaced logo's old object is deleted, in §19's order**: store the new
  object, point the row at it, and delete the old one only after
  `ClubService.updateLogo` has committed. A failed delete is logged and does not
  fail the request, and only a key `MediaKeys.belongsToClub` recognises as that
  club's own is ever deleted — never a seeded Unsplash URL. An upload whose
  database write fails orphans its new object (§21, accepted). **An event photo
  can be removed since 2026-09-15** — `DELETE /events/{id}/images/{index}` takes
  it off the row, and the controller deletes the object only after that commits
  and only if `MediaKeys.belongsToEvent` recognises it, the logo's order exactly.
  Club photos still have no delete endpoint, and nothing deletes a club's or
  event's objects when the row goes (§20).

## Before you change any of this

**Presigned uploads are decided against, not pending** —
[ADR-010](../../docs/decisions/ADR-010-uploads-stream-through-the-api.md),
accepted 2026-09-12. Reopening it means an ADR that supersedes that one, not a
refactor, and its revisit triggers are listed there: media past 5MB, or upload
traffic that is a measurable share of backend memory.

**The old argument for it is spent.** ADR-007 rejected presigning partly because
the local store could not presign. MinIO can. If the subject comes back, argue it
on the content-validation ground, which still holds, and not on that one.

**Building the missing avatar read path** should follow the club and event ones
above rather than inventing a second shape — same index addressing, the same
`StoredImageResponses`, same `/media/**` rewrite. Events followed it on
2026-09-12. If that ever stops scaling,
the replacement is presigned or CDN URLs for *all* media at once, which is an
ADR, not a per-feature choice.
