# Event images served, and uploads over 1 MB reach the API on Elastic Beanstalk

**Status:** approved by Arpan 2026-09-12 · **Date:** 2026-09-12

## Goal

An event photo uploaded through the API can be displayed. Today it lands in the
bucket under `events/{id}/banners/` and nothing serves it back; worse,
`adapters.ts:65` hands the raw key to `next/image`, which throws during render and
takes down the event page and every card that shows the event
([BUG-042](../bugs/bugs.md#bug-042), events half). After this ships, event photos
are stored under `events/{id}/images/`, served by `GET /api/v1/events/{id}/images/{index}`
through the same `/media/**` rewrite clubs use, and a production upload of up to
10 MB gets past the nginx proxy Elastic Beanstalk puts in front of the container,
whose default body limit is 1 MB.

## Out of scope

- **The event banner request.** A club owner or admin choosing at most one photo
  per event and asking the platform owner to feature it, the approval queue, and
  showing approved banners in the homepage carousel and the event page hero.
  Queued as its own unit, with an ADR for its data shape, at wrap-up.
- **An upload control for event photos** in the create or edit form
  (`todo.md:197`). `POST /events/{id}/images` stays reachable only through the
  API.
- **Club banner display.** `club.images` is still rendered nowhere; BUG-043.
- **Profile avatars** — the other half of BUG-042 stays open.
- **Deletes.** Event photos have no delete, and deleting an event or club still
  deletes none of its objects.
- **The HTTPS redirect `.ebextensions` file** from `connecting-elastic-beanstalk.md`
  §3. `package-eb.mjs` learns to stage `deploy/eb/` hidden directories generally,
  so that file needs no second change when it lands.
- **The DTO contract.** `EventDTO.images` keeps its name; `contracts/` is untouched.

## Decisions taken

All put to Arpan on 2026-09-12 and answered by him.

1. **No separate banner prefix.** A banner is not a kind of stored object: it is
   one of an event's photos, chosen later and approved by the platform owner.
   `MediaKeys.eventBanner` becomes `eventImage`, writing
   `events/{id}/images/{uuid}.{ext}` — the `clubs/{id}/images/` shape. The
   production bucket is empty; local rows keep their old keys and still read,
   since nothing parses a key's shape (`rules/backend-clubs.md`).
2. **`/images` for both halves.** `POST /api/v1/events/{id}/images` is unchanged;
   the read is `GET /api/v1/events/{id}/images/{index}`, by index against the
   event's own list, never by key ([ADR-007](../docs/decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md)).
   This replaces an earlier answer renaming both to `/banners`, given before
   banners were redefined.
3. **One shared image response.** `ClubController.media` and `imageTypeOf`
   (`ClubController.java:167-214`) move into one class in `s3/`, used by both
   controllers, so the raster-only content types, `nosniff`, `inline` and the
   5-minute cache exist once.
4. **nginx allows `10M`**, matching `spring.servlet.multipart.max-request-size`,
   so Spring stays the one answering an oversize upload with its 413 sentence.
5. **The banner request is a separate unit**; an approved banner shows in the
   **homepage carousel** and as the **event page hero**.
6. **Missing objects are a 404 in production** because the instance role now has
   `s3:ListBucket` (applied 2026-09-12), not because of a code mapping — Arpan
   chose the IAM fix. Recorded here because MinIO cannot tell the two apart.

## Open questions

- **None blocking.** One detail follows the club shape rather than being a new
  choice: the event adapter passes through absolute URLs **and root-relative
  paths** unchanged, because `adapters.test.ts:83` already expects `/a.jpg` to
  survive, and the read endpoint answers 404 for a stored value that is not an
  object key (`http…` or a leading `/`) rather than asking S3 for it.
- **The nginx override is unverifiable before the first deploy.** Local and CI
  have no nginx; it is proved by the 3 MB upload in `connecting-s3.md` §5.

## Files expected to change

**Backend**
- `backend/src/main/java/com/campusvibe/s3/MediaKeys.java` — `eventBanner` → `eventImage`, `events/{id}/images`
- `backend/src/main/java/com/campusvibe/s3/` — a new shared image-response class
- `backend/src/main/java/com/campusvibe/club/ClubController.java` — uses it; behaviour unchanged
- `backend/src/main/java/com/campusvibe/event/EventController.java` — the `GET /{id}/images/{index}` read

**Tests**
- `backend/src/test/java/com/campusvibe/event/EventMediaIT.java` — key pattern at `:69`; upload then read back byte-identical, content type and `nosniff`, 404 for an out-of-range index and for a non-key value, public without a token
- `backend/src/test/java/com/campusvibe/club/ClubMediaIT.java` — must stay green unchanged, proving the extraction moved nothing
- `MediaKeysTest` — the event key shape
- `frontend/app/__tests__/adapters.test.ts` — an event key maps to `/media/events/{id}/images/{index}`; URLs and root-relative paths pass through

**Frontend**
- `frontend/app/lib/adapters.ts` — `eventImageUrls`, used by `toEventInstance`
- `frontend/next.config.ts` — the `/media/events/:eventId/images/:index` rewrite

**Deploy**
- `deploy/eb/.platform/nginx/conf.d/client_max_body_size.conf` — **new**, `client_max_body_size 10M;`
- `scripts/package-eb.mjs` — stage `deploy/eb/.platform/` (and any `.ebextensions/`) into the bundle root; update the printed contents

**Docs and rules** (mapped in `scripts/docs-map.json`)
- `api-and-caching.md` — `event/` and `adapters.ts`
- `connecting-elastic-beanstalk.md` — `deploy/eb/`, `package-eb.mjs`
- `connecting-s3.md`, `s3-media/SKILL.md`, `rules/aws-handling.md` — `s3/`
- `ci-cd-pipeline.md` — `next.config.ts`

## Verification

```bash
node scripts/verify.mjs --all --full          # unit, ITs against MinIO, Jest, contract pair

# Bundle carries the nginx override at its root
node scripts/package-eb.mjs --skip-build
tar -tf dist/eb/campusvibe-backend-*.zip       # Dockerfile, app.jar, .platform/nginx/conf.d/client_max_body_size.conf

# Compose stack: upload, serve, render
docker compose -f docker/docker-compose.yml up -d --build
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -F "files=@banner.png" \
     http://localhost:8080/api/v1/events/<id>/images
curl -sSI http://localhost:3000/media/events/<id>/images/0   # 200, image/png, nosniff
curl -sSI http://localhost:8080/api/v1/events/<id>/images/9  # 404
docker compose -f docker/docker-compose.yml exec minio mc ls local/campusvibe-media/events/<id>/images/
# then open /events/<id> and a page with its card — the photo renders, no crash
```

After the first Elastic Beanstalk deploy, `connecting-s3.md` §5 adds a 3 MB
upload (proves nginx) and an event photo read through Vercel.

## To update at wrap-up

- **STATUS.md** — shipped line; *Now* gains the banner request unit
- **`TODO/todo.md`** — new P2: the event banner request (one photo per event, club
  owner or admin requests, platform owner approves, shown in the homepage carousel
  and the event page hero, ADR for its shape); `:169` (event read path) to
  `tasks-completed.md`; `:197` stays
- **`bugs/`** — BUG-042 narrowed to avatars only, the events half recorded as fixed
- **`rules/backend-clubs.md`** — the keys bullet names `events/{id}/images/`;
  **`rules/frontend.md`** — event images go through `adapters.ts` too;
  **`rules/ci-and-build.md` or `aws-handling.md`** — the nginx 1 MB default no
  local test can see
- **`rules/aws-handling.md`** — CORS removed, `s3:ListBucket` granted, `AWS_S3_BUCKET`
  set and `S3_BUCKET_NAME` removed (all 2026-09-12); and the mismatch that the
  hook refuses `delete-bucket-cors` although the rule allows S3 bucket writes
- **`connecting-s3.md`** — §1 and §2 checked, the `ListBucket` row, the nginx
  and event-photo steps in §5, new stamp
- **`s3-media/SKILL.md`, `reference.md` §7** — the event prefix
- **ADR-012** is frozen and names `events/{id}/banners/` in passing; no edit — the
  spec and SKILL carry the change
- **`aws-deployment.md`** — the three 2026-09-12 account changes recorded
- **This spec** — `Status: shipped`
