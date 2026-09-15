# S3 connected end to end — MinIO locally, one bucket in production

**Status:** shipped · **Date:** 2026-09-12

## Goal

A club logo or an event banner uploaded through the API lands in a real S3
bucket in production and in a real S3-compatible store locally, through **one
code path** exercised in both. Today neither half is true: uploads go to
`FakeS3`, a filesystem stub that is not an `S3Client` in the way that matters,
and production resolves two buckets that do not exist in a region the bucket is
not in. After this ships, `FakeS3` is gone, `S3Config` always builds a genuine
`S3Client`, local development and CI point it at MinIO, production points it at
`campusvibe-prod-media` in `ca-central-1`, and an upload-then-read round trip is
verified against both. This also closes [BUG-051](../bugs/fixed_bugs.md#bug-051) and
settles the presigned-upload question that has been the first item in
[`STATUS.md`](../STATUS.md).

## Out of scope

- **Presigned URLs, for uploads or reads.** Decided against below; `reference.md`
  §9 stays unimplemented and the sections describing it get a banner saying so.
- **Event banner and profile avatar read paths** ([BUG-042](../bugs/bugs.md#bug-042)).
  An event banner will upload to the right bucket after this and still not be
  displayable. That is the club-shaped read path's own unit.
- **§20 deletes.** Banner images still have no delete endpoint, and deleting a
  club or an event still deletes none of its objects.
- **CloudFront, a public bucket, versioning or lifecycle on the bucket.**
  [ADR-007](../docs/decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md)'s
  revisit triggers are unchanged by this work.
- **Re-encoding uploads to WebP** (`reference.md` §14).
- **The frontend.** `adapters.ts` and the `/media/**` rewrite in
  `next.config.ts` are correct as written and are not touched.

## Decisions taken

All four put to Arpan on 2026-09-12 and answered by him.

1. **Uploads keep streaming through the API** — multipart `POST` to the backend,
   which sniffs the leading bytes and writes with `S3Service.putObject`.
   Presigned `PUT` was rejected: the backend never sees the bytes, so the
   content validation that is the whole of the [BUG-039](../bugs/fixed_bugs.md#bug-039)
   fix could not run before the object lands. This extends
   [ADR-007](../docs/decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md)'s
   chosen option from reads to writes. **ADR-010.**
2. **MinIO replaces `FakeS3` entirely** as the local and CI store, and every
   trace of `FakeS3` and of the commented-out `adobe/s3mock` block is removed
   from the backend and the documentation — Arpan was explicit about the
   removal, not just the replacement. Note this was chosen *despite* presigning
   being rejected: the reason is one code path, not presign capability.
   **ADR-011.**
3. **One bucket with prefixes.** Everything points at `campusvibe-prod-media`;
   `S3Buckets` collapses to a single property. `MediaKeys` already writes
   `clubs/{id}/…` and `events/{id}/…`, so **no object key changes and nothing
   needs migrating**, and the existing inline grant on
   `CampusVibe-ElasticBeanstalk-EC2Role` already covers exactly this bucket, so
   **no IAM change and no new spend**. **ADR-012.**
4. **The ADRs and the wiring ride in this one unit.** Arpan accepts the three
   records before the code is written; the read paths and deletes do not ride
   along.

Three ADRs rather than one because `adr.md` is one decision per file and these
are three separable choices — the upload model, the local store, and the bucket
topology — each with a real alternative and its own revisit trigger. Consecutive
numbers, per the numbering rule.

## A finding that arrived with the reading

`application.yml:48` defaults `aws.region` to `us-east-1`, `docker-compose.yml:117`
repeats it, and `campusvibe-prod-media` is in **`ca-central-1`**
([`rules/aws-handling.md`](../rules/aws-handling.md)). The `CampusVibe-Backend-Prod`
environment sets `S3_BUCKET_NAME`, which no code reads, and neither bucket
variable. So the first real `S3Client` this project ever builds would be built
for the wrong region and pointed at a bucket that does not exist — two failures
stacked, only one of which BUG-051 records. It has never been observed because
no upload has ever reached real S3. Fixing the region default is in scope here;
it is part of *make code, environment and IAM agree*.

## Open questions

- **Nothing blocking.** Two things to confirm against the account when the
  wiring starts, both read-only and both inside the hook's allowlist: that
  `SPRING_PROFILES_ACTIVE` on the environment really is `prod` (BUG-051 records
  this as inference, not measurement — the permission classifier refused the
  call), and the bucket's current CORS rule, which `aws-handling.md` describes as
  `GET,PUT` from the prod origin. Streaming uploads need no browser-facing CORS
  on the bucket at all, so that rule is now either harmless or worth narrowing —
  narrowing it is an *ask first* change and will be proposed, not made.
- **MinIO's root credentials are non-secret dev values** that must be readable
  in `docker-compose.yml` without becoming a habit of committing credentials.
  Proposal: compose defaults with an env override, exactly as the database
  password is handled today. Flagging rather than deciding.

## Files expected to change

Code, and the docs and rules `scripts/docs-map.json` maps to it.

**Backend**
- `backend/src/main/java/com/campusvibe/s3/FakeS3.java` — **deleted**
- `backend/src/main/java/com/campusvibe/s3/S3Config.java` — always a real
  `S3Client`; endpoint override plus path-style access when `aws.s3.endpoint` is
  set, the default credential provider chain when it is not. The `aws.s3.mock`
  boolean goes away, which also closes the *fails open* P3 in
  [`todo.md`](../TODO/todo.md): with no flag there is nothing to fail open.
- `backend/src/main/java/com/campusvibe/s3/S3Buckets.java` — one `media`
  property replacing `clubs` and `events`
- `backend/src/main/java/com/campusvibe/club/ClubController.java`,
  `backend/src/main/java/com/campusvibe/event/EventController.java` — the four
  `buckets.getClubs()` / `getEvents()` call sites
- `backend/src/main/java/com/campusvibe/s3/MediaKeys.java` — the key-shape guard
  that `FakeS3.buildObjectFullPath` has been carrying as the second line of
  defence since BUG-039 has to survive its deletion, in `MediaKeys` instead
- `backend/src/main/resources/application.yml` — `aws.region` default to
  `ca-central-1`, `aws.s3.mock` out, `aws.s3.endpoint` in, one bucket property
- `backend/src/main/resources/application-prod.yml` — `mock: false` out; prod is
  simply the case where no endpoint override is set
- `backend/src/main/resources/application-test.yml` — `aws.s3.mock: true` out

**Tests**
- `backend/src/test/java/com/campusvibe/s3/FakeS3Test.java` — **deleted** (8 tests)
- `backend/src/test/java/com/campusvibe/MinioTestContainer.java` — **new**, the
  shape `PostgresTestContainer.java` already sets
- `ClubMediaIT` (15), `EventMediaIT` (3), `MediaUploadLimitIT` (2),
  `MediaKeysTest` (19) — re-pointed at the container; `MediaKeysTest` gains the
  traversal cases `FakeS3Test` was carrying

**Infrastructure**
- `docker/docker-compose.yml` — a `minio` service and a one-shot bucket-create
  init; the commented `adobe/s3mock` block at `:40-46` deleted; the four
  `AWS_S3_*` backend variables replaced
- `docker/.env.example`, `.github/workflows/_docker.yml` — the same variables
- The `CampusVibe-Backend-Prod` environment properties — **Arpan's to set**, an
  *ask first* change under `aws-handling.md`: `AWS_S3_BUCKET_MEDIA`,
  `AWS_REGION=ca-central-1`, and the unread `S3_BUCKET_NAME` removed

**Docs and rules**
- `.claude/skills/s3-media/SKILL.md` — *What is actually built today* is
  rewritten; every `FakeS3` paragraph goes, including the BUG-039 one, and
  *Before you change any of this* stops queuing a decision that is now made
- `.claude/skills/s3-media/reference.md` — §9's presigned flow gets a banner
  pointing at ADR-010 rather than being silently contradicted
- `.claude/rules/aws-handling.md` — the *the backend reads `AWS_S3_BUCKET_CLUBS`
  and `AWS_S3_BUCKET_EVENTS`* bullet is wrong after this
- `.claude/docs/architecture/aws-deployment.md`,
  `CampusVibe_AWS_Deployment_Guide.md` §Phase 3 — both still say no S3
- `.claude/docs/decisions/` — ADR-010, ADR-011, ADR-012 and three rows in both
  indexes

## Verification

```bash
# Backend, with the container-backed media ITs
cd backend && mvn verify

# The whole CI gate, locally
node scripts/verify.mjs
node scripts/check-docs.mjs

# The round trip MockMvc cannot reach — a real port, a real multipart body,
# against MinIO in the compose stack
docker compose -f docker/docker-compose.yml up -d
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
     -F "file=@fixtures/logo.png" \
     http://localhost:8080/api/v1/clubs/<id>/logo
curl -sSI http://localhost:3000/media/clubs/<id>/logo   # 200, image/png, nosniff
docker compose -f docker/docker-compose.yml exec minio mc ls local/campusvibe-media/clubs/<id>/logos/
```

Against the live account, read-only and within the hook's allowlist: `aws s3api
list-objects-v2 --bucket campusvibe-prod-media --prefix clubs/` returns the
object after one upload through the deployed environment. **A production upload
is only attempted once Arpan has set the environment properties**, since
nothing else can make it succeed.

## To update at wrap-up

- **STATUS.md** — a shipped line, and *Now* loses its first item
- **`TODO/tasks-completed.md`** — the presigned-upload ADR item, item 337 (the
  topology), and the `aws.s3.mock` fails-open P3
- **`TODO/todo.md`** — item 336 (the IAM role) reduced to what is left; item 338
  (reconciling `aws-deployment.md`) partly absorbed
- **`bugs/fixed_bugs.md`** — BUG-040 (renumbered BUG-051) moved across with the region finding
  recorded as the part it missed. **Also fix while there:** `bugs.md:439-441`
  has BUG-042's heading immediately followed by the bucket bug's (then BUG-040, now BUG-051), so one entry's body
  reads as the other's, and BUG-039 is still headed OPEN at `bugs.md:517` after
  being fixed on 2026-09-11
- **`docs/decisions/`** — ADR-010, ADR-011, ADR-012, and a row for each in
  `decisions/README.md` and `docs/README.md`; the *Waiting to be written* row
  for presigned uploads is struck
- **`rules/`** — `aws-handling.md` as above; a `backend-java` or new media line
  carrying *keys are validated in `MediaKeys`, not by the store*, with BUG-039's
  id, since the store no longer guards it
- **`docs/architecture/`** — the reasoning, per `implementation-docs`: either a
  new media doc or `aws-deployment.md`'s Phase 3 section
- **This spec** — `Status: shipped`

## Shipped 2026-09-12 — where the work drifted from this spec

Recorded at wrap-up, because each is a fact Arpan needs rather than a detail.

- **BUG-051 is not closed.** The goal said this unit closes the bucket bug.
  The code side is done, but production still sets none of the properties the
  code reads, so the bug's actual symptom remains — and a deploy of current
  code now refuses to start. It stays open in `bugs.md` until the environment
  is set; it was renumbered from BUG-040 on the way, the third id collision.
- **Production was not verified**, which the goal also promised. Nothing could
  make an upload succeed there before the environment properties are set, and
  setting them is Arpan's.
- **The environment variable is `AWS_S3_BUCKET`**, not `AWS_S3_BUCKET_MEDIA` —
  with one bucket, the suffix distinguishes nothing.
- **`S3Buckets` was replaced by a new `MediaBucket`** rather than collapsed in
  place, so the type name stops describing two buckets.
- **Added beyond the spec:** `NoSuchKeyException` maps to a 404 (swapping the
  store made it reachable); a blank bucket name is rejected at startup;
  `commons-io` removed with its only consumer; `SearchIT` and
  `SearchRateLimitIT` name the bucket inline, since they skip the `test`
  profile.
- **MinIO is pinned from `quay.io`**, not Docker Hub, where it is not published.
- **No new architecture doc.** The reasoning lives in ADR-010 to ADR-012 and the
  as-built state in `s3-media/SKILL.md`. `aws-deployment.md` got a dated pointer,
  not a reconcile — that stays its own queue item.
- **The frontend `/media/**` rewrite was not re-exercised live.** It is
  unchanged; the round trip was checked at the API.
- **Arpan's local `docker/.env`** had its AWS block replaced, with a backup at
  `docker/.env.bak.20260912`. It is gitignored and not part of the diff.
