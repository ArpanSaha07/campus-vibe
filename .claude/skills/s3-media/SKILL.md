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

- **There is no presigning at all.** `S3Service.java` has exactly two methods,
  `putObject` (`:22`) and `getObject` (`:30`), both moving raw bytes through the
  backend. Every presigned-URL rule above describes work that has not started.
- **Reading is done by streaming through the API, and only for clubs.**
  `GET /api/v1/clubs/{id}/logo` and `/images/{index}`
  (`ClubController.java:125`, `:142`) are the only read path that exists;
  `getObject` had no caller at all before 2026-09-09. Chosen over presigned or
  public URLs because `FakeS3` cannot presign and no bucket or CDN is
  provisioned to be public with — Arpan, 2026-09-09. **Event banners and
  profile avatars still have none**, so an uploaded event image cannot be
  displayed.
- **Images are addressed by index, never by key.** An endpoint that took a key
  from the caller would fetch any object in the bucket it was pointed at. The
  index is resolved against that club's own list.
- **An uploaded SVG is never served as `image/svg+xml`.** `imageTypeOf`
  (`ClubController.java:192`) names raster types only and falls back to
  `application/octet-stream`, with `nosniff`. Nothing validates uploads
  ([BUG-039](../../bugs/bugs.md#bug-039)), and an SVG is a document that can
  carry script — serving one as an image would execute it on the API's origin.
  Do not "fix" this by adding svg to that map.
- **A stored key is not a URL, and the frontend must never render one.** That is
  what [BUG-040](../../bugs/fixed_bugs.md#bug-040) was: the key reached
  `next/image`, which throws at render time rather than failing to load, so the
  page came down. `adapters.ts` maps keys onto `/media/...` and
  `next.config.ts` rewrites that to the API.
- **`aws.s3.mock` swaps the client.** True by default, so `S3Config.java:18-26`
  hands back `FakeS3`, which writes to `~/.arpan/s3` on the local disk
  (`FakeS3.java:24`, carrying its own TODO about Windows). `application-prod.yml`
  sets it false.
- **Two buckets, not one.** `S3Buckets.java` exposes `clubs` and `events`
  (`application.yml:49-51`); the reference assumes a single bucket with prefixes,
  and nothing exists for profile images.
- **Keys are built from the client's filename** — `ClubController.java:82` and
  `:91`, and `EventController.java:108`, concatenate
  `file.getOriginalFilename()` straight into the key, against §7 and §13. Same
  filename twice silently overwrites the object, and no uuid means §19's
  replace-then-delete ordering cannot be built on top. Filed as
  [BUG-039](../../bugs/bugs.md#bug-039), which also records what is *not* wrong:
  size is capped at 10MB by `application.yml:30-31`, and `..` in a filename is
  not traversal.

## Before you change any of this

The gap above is a decision, not an oversight to fix in passing: moving to
presigned uploads changes the frontend, the endpoints and the stored keys at
once, and existing rows would need a backfill. Ask Arpan, and write an ADR
rather than a rider on another feature. Stopping the caller naming the object,
while keeping direct byte upload, is the much narrower fix and closes most of
[BUG-039](../../bugs/bugs.md#bug-039) on its own.

**Building the missing event and avatar read paths** should follow the club one
above rather than inventing a second shape — same index addressing, same
content-type restriction, same `/media/**` rewrite. If that ever stops scaling,
the replacement is presigned or CDN URLs for *all* media at once, which is an
ADR, not a per-feature choice.
