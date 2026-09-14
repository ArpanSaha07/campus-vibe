# Upload keys are generated server-side — the narrow fix for BUG-039

**Status:** shipped 2026-09-11 · **Date:** 2026-09-11

> **Where the work went beyond this spec**, recorded because the spec is the
> record of what was agreed:
>
> 1. **`MediaKeys` refuses a club id that is not one path segment** — a slash,
>    a backslash or a dot segment. Club slugs are client-chosen and nothing
>    validates their shape; unreachable through a URL today, but the key should
>    not depend on the firewall. The real control is queued as a P3.
> 2. **A multi-file upload is all-or-nothing.** Every file is checked before any
>    is stored, on both the club and the event endpoint, so one refused file
>    does not leave the others stored behind a 400.
> 3. **`MediaUploadLimitIT` runs on a real port.** The spec put the 413 test in
>    `ClubMediaIT`; MockMvc never applies the multipart caps, so it could not
>    live there.
> 4. **`verify --full` is red on one test**, `SearchIT.semanticSearchMatches…`
>    ([BUG-001](../bugs/bugs.md#bug-001)), which fails identically on a clean
>    worktree at `77baaab`. Shipped under the same exception as
>    [`2026-09-10-proposal-social-links.md`](2026-09-10-proposal-social-links.md).
> 5. **The traversal write was never observed**, only read from the code — by the
>    time a test exercised it, the `FakeS3` guard already answered 500. Step 5
>    of *Verification* (a legacy key still renders) was covered by `ClubMediaIT`
>    rather than the stack.

## Goal

No upload names its own S3 object any more, and nothing that is not a PNG, JPEG
or WebP is stored. Today all three upload sites concatenate
`file.getOriginalFilename()` into the key (`ClubController.java:211`, `:220`,
`EventController.java:108`) and check nothing about the bytes. Against `FakeS3`
— the default client everywhere but the `prod` profile (`application.yml:48`,
`docker-compose.yml:116`) — `FakeS3.java:79-81` joins that key onto a disk path,
so a club owner, club admin or event manager who sends `filename=../../x` writes
a file anywhere the backend process can. The knowledge base says the opposite
(`bugs.md:480-482`, `skills/s3-media/SKILL.md:88-89`), which is true of real S3
and false of the client every non-prod environment runs. Raised by the Claude
security review on PR #44; fixed before that PR merges into `develop`.

Afterwards: keys are `{uuid}.{ext}` under a server-built prefix, the extension
comes from the file's own leading bytes, a repeated upload no longer overwrites,
a replaced logo's old object is deleted, `FakeS3` refuses any key that resolves
outside its root, the backend caps a file at 5MB, and the knowledge base says
what is actually true.

## Out of scope

- **Presigned uploads, and presigned reads.** The model in `reference.md` §9 is
  the next unit, with its own ADR — see *Decisions taken*. Nothing here touches
  [ADR-007](../docs/decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md);
  media is still streamed by the API.
- **Re-encoding to WebP** (`reference.md` §14). The stored format is what was
  uploaded; the reference says not to block on image processing.
- **Migrating existing keys.** Reads use whatever key is stored, so
  `clubs/{id}/logo-{filename}` rows keep working. No Flyway change, no backfill.
- **Deleting banner or event images.** There is no delete endpoint for either,
  and events only ever append. Only a *replaced club logo* deletes anything.
- **Deleting a club's or event's objects when the row is deleted** (§20).
- **Event banner and avatar read paths** — [BUG-042](../bugs/bugs.md), unchanged.
- **The `aws.s3.mock: true` default** (`application.yml:48`). Any environment
  without the `prod` profile and without the variable runs `FakeS3`. Production
  is covered by `application-prod.yml`; this is noted in `todo.md` at wrap-up,
  not changed.
- **Real multipart parsing.** `MockMvc` does not run Tomcat's parser, so the
  tests prove the controller ignores the filename, not that Spring passes `../`
  through. The fix makes that question moot, since the filename is never read.

## Decisions taken

- **Fix before PR #44 merges into `develop`** — Arpan, 2026-09-11. Supersedes
  the ship-then-fix call recorded at `STATUS.md:20`, which was made believing a
  `..` in a filename was harmless.
- **The narrow fix now; the presigned-upload ADR as its own unit, straight
  after** — Arpan, 2026-09-11. `bugs.md:501-507` names the narrow fix; the ADR
  has to answer ADR-007's reason for rejecting presigning (`FakeS3` cannot
  presign), which deserves its own `/start`.
- **PNG, JPEG and WebP only, decided by the file's leading bytes** — Arpan,
  2026-09-11, per `reference.md` §12. The declared part `Content-Type` and the
  filename are ignored entirely. GIF and SVG are refused.
- **5MB per file, 10MB per request** — Arpan, 2026-09-11.
  `application.yml:30-31`, today 10MB / 10MB. 10MB per request keeps a
  multi-banner `POST /clubs/{id}/images` workable.
- **Reference key layout** — Arpan, 2026-09-11, per `reference.md` §7:
  `clubs/{id}/logos/{uuid}.{ext}` · `clubs/{id}/images/{uuid}.{ext}` ·
  `events/{id}/banners/{uuid}.{ext}`. The endpoint paths do not change.
- **A replaced logo's old object is deleted after the database update** —
  Arpan, 2026-09-11, per `reference.md` §19.
- **All eight points of the PR #44 triage plan are in scope** — Arpan,
  2026-09-11. They are the file list below.

Proposed by Claude as conventions rather than choices. Flag any you disagree with
before approving:

- **A refused type is a 400** through the existing `RequestValidationException`
  handler (`DefaultExceptionHandler.java:118`), with a sentence naming the
  allowed types. An empty file is refused the same way.
- **An oversize file is a 413 with a sentence**, through a new
  `MaxUploadSizeExceededException` handler. Today it falls through to the 500
  catch-all (`DefaultExceptionHandler.java:225`), and a 5MB cap makes that
  reachable by any phone photo.
- **The old logo is deleted after the transaction commits, never inside it.**
  `ClubService.updateLogo` (`ClubService.java:171-176`) returns the previous key;
  the controller deletes it once the call returns. Deleting inside the
  transaction would leave the row pointing at a deleted object if the commit
  failed.
- **A failed delete is logged and does not fail the request.** The logo is
  already replaced and correct; an orphaned object is the cost (§21). The key
  goes through `common/Logs` first ([`rules/backend-java.md`](../rules/backend-java.md)).
- **Only a stored key under that club's own `clubs/{id}/` prefix is deleted** —
  never an absolute URL (the seeded Unsplash rows), never null. A legacy
  `logo-{filename}` key is under the prefix and is deleted like any other.
- **An upload whose database write fails leaves the new object orphaned.**
  Accepted, not cleaned up (§21).

## Open questions

None. The four left open by the brief were answered by Arpan on 2026-09-11 and
are recorded above.

## Files expected to change

**Backend** — mapped to `api-and-caching.md`, the `s3-media` skill,
`rules/backend-clubs.md` and `rules/backend-java.md`:

1. `s3/` — one new helper, the only thing that builds a media key. It sniffs the
   leading bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`),
   refuses anything else or an empty file, and returns
   `{prefix}/{uuid}.{png|jpg|webp}`. It never reads the filename.
2. `club/ClubController.java:208-224` and `event/EventController.java:103-113` —
   all three sites call it. `uploadLogo` deletes the previous key after
   `updateLogo` returns, per the conventions above.
3. `club/ClubService.java:171-176` — `updateLogo` returns the previous key.
4. `s3/S3Service.java` — `deleteObject`.
5. `s3/FakeS3.java` — `buildObjectFullPath` resolves through `Path`, normalises,
   and throws unless the result stays under the root; `deleteObject`
   implemented, since the `S3Client` default throws.
6. `exception/DefaultExceptionHandler.java` — the 413 handler.
7. `resources/application.yml:30-31` — `max-file-size: 5MB`,
   `max-request-size: 10MB`.
8. Comments that describe the old key shape: `ClubController.java:116-117`, and
   the cache rationale at `:175-179`, which argues from the filename being in
   the key. The URL `/clubs/{id}/logo` never changed, so the five-minute cache
   stays and only the reasoning is rewritten.

**Tests:**

- `club/ClubMediaIT.java`:
  - a `../../../../tmp/evil.png` filename is stored under
    `clubs/robotics/logos/` and nothing is written outside the `FakeS3` root;
  - the same filename uploaded twice as banners gives two distinct keys, both
    readable;
  - replacing a logo deletes the old object and the new one is served;
  - an SVG, a GIF and a text file renamed `.png` are each a 400 and store
    nothing;
  - a file over 5MB is a 413;
  - `:61` asserts the key by pattern, not by the exact old string;
  - `anUploadedSvgIsNeverServedAsSvg` becomes the 400 case above, and the
    read-side guarantee (ADR-007, rule 2) keeps its own test by writing a `.svg`
    key straight onto the row, the way `:122` already seeds an external URL.
- An event upload test — none exists for `POST /events/{id}/images` today.
  Traversal filename, `events/{id}/banners/` prefix, a refused type.
- A unit test for the `FakeS3` guard: a key containing `../` that escapes the
  root throws, and nothing is written.
- A unit test for the key helper: each of the three signatures, a refusal, and
  a key that never contains the original filename.

**Frontend** — mapped to `api-and-caching.md`:

- `components/club/CreateClubForm.tsx:279` — `accept="image/png,image/jpeg,image/webp"`.
- `lib/validators/clubValidator.ts:120` — the same three types, not any `image/`,
  with its test. The server's 400 and 413 already reach the user through
  `parseApiError`.
- Comments naming `clubs/{id}/logo-{filename}`: `lib/adapters.ts:11`,
  `components/club/ClubLogo.tsx:26`, `__tests__/ClubLogo.test.tsx:6`. The
  legacy example keys in `ClubLogo.test.tsx:27` and `adapters.test.ts:112` stay
  — such rows exist and the adapter must keep mapping them.

Docs, skills and rules mapped to those paths, from
[`docs-map.json`](../../scripts/docs-map.json): `docs/architecture/api-and-caching.md`,
`skills/s3-media/SKILL.md`, `rules/backend-clubs.md`, `rules/backend-java.md`.

## Verification

```
node scripts/verify.mjs --all --full        # what CI runs, ITs included
./mvnw -B verify -f backend/pom.xml         # ClubMediaIT and the event upload test
npm test --prefix frontend
```

Then in the running stack (`docker compose up`), as a club owner:

1. Upload a logo — it renders, and the stored key is `clubs/{id}/logos/{uuid}.png`.
2. Replace it — the new one renders, and the old file is gone from
   `~/.arpan/s3/` in the backend container.
3. Send `filename="../../../../tmp/probe.png"` with `curl -F` — 200, the key is
   under `clubs/{id}/logos/`, and `/tmp/probe.png` does not exist in the
   container. This is the case `MockMvc` cannot reach.
4. Upload an SVG and a 6MB JPEG through the form — each is refused with a
   sentence, not a 500.
5. A club with a legacy `logo-{filename}` key still renders its logo.

## To update at wrap-up

- `bugs/bugs.md` → `bugs/fixed_bugs.md` — **BUG-039** closes. The entry records
  that the `..` claim at `bugs.md:480-482` was wrong for `FakeS3`, that the
  traversal was found by the PR #44 security review rather than by us, and that
  the presigned model is now an ADR rather than part of this bug.
- `skills/s3-media/SKILL.md` — *What is actually built today*: keys generated
  server-side, the three types sniffed, 5MB, the old logo deleted, the `FakeS3`
  guard. Correct `:86-89`, and drop BUG-039 from `:66-69`.
- `rules/backend-java.md` — one line: never build an object key from
  `getOriginalFilename()`; `FakeS3` turns `..` into a real disk path
  (BUG-039). It loads on every backend file, which is where all three upload
  sites and `s3/` live.
- `rules/backend-clubs.md` — the key-holding bullet names the new layout.
- `docs/architecture/api-and-caching.md:300` — the key shape, and its
  `Code as of:` stamp.
- `docs/decisions/README.md` — a *Waiting to be written* row for the
  presigned-upload ADR, forced by this unit. **ADR-007 is not edited**: it is
  Proposed and frozen, and its SVG rule stands as defence in depth.
- `TODO/todo.md` — the presigned-upload ADR as the next item; the
  `aws.s3.mock` default as a P3 note.
- `STATUS.md` — `:20` loses BUG-039; *Now* gains the presigned-upload ADR ahead
  of the club editor. `TODO/tasks-completed.md`.
- Mark this spec `Status: shipped`.
