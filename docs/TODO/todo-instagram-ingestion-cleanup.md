# Instagram ingestion — cleanup before `develop`

Added 2026-11-25 · Branch: `arpan/feature/instagram-ingestion` (Gabriel's work merged as `0c43fe4`,
range `1deca41..0c43fe4`, commits `24f1c71`, `961a079`, `040415c`).

What came out of running the import locally and a `/code-review` of the merged range. The
pipeline itself works: a local run against 20 accounts fetched 15 stories and 43 posts and
published 7 real events. The items below are what stands between that and `develop`.

Design doc: [`instagram-import.md`](../architecture/instagram-import.md) · Spec:
[`2026-11-25-instagram-auto-import.md`](../specs/2026-11-25-instagram-auto-import.md).

Priorities as in [`todo.md`](todo.md): **P0** blocking · **P1** next up · **P2** planned · **P3** backlog

---

## Demo state — shown 2026-11-26 with known gaps

Arpan decided on 2026-11-25 to showcase the branch the next day as it stands, setting the
usual checks aside. **Nothing in this file is fixed by the demo**; the branch is not ready
for `develop` until the P0 items below are done. What is true of the branch on demo day:

**Works, proved locally on 2026-11-25:** a startup run against 20 accounts fetched 15
stories and 43 posts through Gabriel's gateway, Claude found 10 events, 7 published with
their poster as banner and an Instagram link, and 6 clubs were created for the accounts.
`GET /api/v1/events` returns them with `sourceUrl` set.

**Broken or missing, seen by Arpan (to be fixed by Arpan after the demo):**

- [ ] **P0** **The UI is broken** around imported events. Not yet itemised: write down each
  broken screen after the demo, before fixing. Two fixed 2026-11-26: the card now opens
  the event page instead of Instagram, and a poster fills 80% of the card's width
  instead of a third ([`instagram-import.md`](../architecture/instagram-import.md)).
- [ ] **P0** **Events are created for clubs that do not exist as real club pages, while an
  event page can only exist for an existing club.** The workflows disagree:
  `InstagramPublishService.clubFor` makes a placeholder club owned by the platform admin
  (`InstagramPublishService.java:222-240`), which the rest of the product does not treat as a
  real club. Decide the owner question from the spec first (platform admin or the claim flow).
  **Now also blocks clubs connecting their own account** (2026-11-26): a handle linked to a
  placeholder club is refused with a 409 on the club dashboard's Instagram page, so a real
  club whose account was imported first cannot connect it.
- [x] **P1** **Import controls in the admin and club-admin dashboards** — done 2026-11-26,
  except reviewing held candidates. Admin: N, Import now, the last ten runs. Club: connect
  the handle, auto-import, Import now for that account alone. See
  [`tasks-completed.md`](tasks-completed.md).
- [ ] **P2** **No way to review held candidates** (`PENDING_REVIEW`) from the UI. They stay
  in the table, unpublished; the last two local runs held four.

**Needed to run it at all (a fresh machine or environment):**

- `INSTAGRAM_FETCHER_URL` must point at Gabriel's gateway, and `ANTHROPIC_API_KEY` must be
  set, in `docker/.env`; neither has a usable default.
- **A platform admin must exist before the first run**, or every candidate fails to publish
  and stays stuck: set `APP_BOOTSTRAP_ADMIN_ENABLED=true` (the value, not just a non-empty
  line) and `APP_BOOTSTRAP_ADMIN_EMAIL` to an account that already exists, then restart the
  backend.
- The startup run fires only when the last run is over 11 hours old; there is no button.

**Checks skipped for the demo — each still owed:**

- [ ] No Proposed ADR, and the spec is still draft (see *Process and docs*).
- [ ] The docs and rules `check-docs.mjs` flagged on the merge are not updated.
- [ ] The P0 review findings below are open; the demo runs with them.
- [ ] `/wrap-up` ran in reduced form: no `docs-map` pass, no bug entries in `bugs.md` (the
  findings live here instead), spec left draft rather than marked shipped.

---

## P0 — Correctness and security (from the review)

- [ ] **A held-back candidate swallows the clear post about the same event.**
  `markDuplicate` compares against `findLiveBetween`, which also returns `PENDING_REVIEW`
  candidates held by `CandidateRules.publishBlockers` (low confidence, uncertain date,
  auto-publish off) — `InstagramImportService.java:501`. There is no review screen, so the
  held one never publishes, and the later clear poster becomes `DUPLICATE` with
  `duplicateOfEventId` null. *Example:* a 9:00 teaser for Jazz Night at confidence 0.6 is
  held; the 21:00 poster matches it and the event never appears.
  **Fix:** compare only against `PUBLISHED` candidates and events, or publish the
  unblocked one and mark the held one as the duplicate.

- [ ] **Duplicate detection merges events from different clubs.** The rules never look at
  the source or club — `CandidateRules.java:160`. `sameSlot` treats a short location as a
  match for a longer one (`titleSimilarity` returns 1 on token containment), the 30-minute
  rule needs only 0.5 title similarity, and `markDuplicate` (`InstagramImportService.java:492-497`)
  also checks events clubs typed in themselves. `InstagramPublishService.enrich`
  (`InstagramPublishService.java:136`) then copies the second club's registration link and
  highlights into the first club's event. Locations like *Online* or *McGill* merge every
  event in the same half hour.
  **Fix:** only treat two events as the same when they share a source or club, or come from
  the same reshared post; require more than one shared location token; never enrich an
  event across clubs.

- [ ] **Overlapping import runs publish the same event twice.** The 2-hour lease is never
  renewed, but a full 200-account run can take longer — `InstagramImportService.java:195`. A
  task that times out keeps running after `shutdownNow` (blocking HTTP ignores interrupts)
  while the lease is released. `candidateLock` lives in one JVM, so two Elastic Beanstalk
  instances both get past de-duplication. A story left in `PROCESSING` is never retried:
  `InstagramStoryRepository.findRetryable` selects only `PENDING` and `FAILED`.
  **Fix:** renew the lease between batches, or take a database lock around candidate
  creation; await termination before releasing the lease; retry stale `PROCESSING` stories.

- [ ] **Event links accept any https URL the fetcher returns.** `StoryMediaDownloader`
  allows only Instagram CDN hosts for images, but `applySourceLinks` checks only the
  `https://` prefix — `InstagramPublishService.java:185`, fed from
  `StoryFetcherClient.java:192` and `:237`. That link is every imported card's click target
  and the event page's Instagram button, so a misconfigured or compromised fetcher can send
  students anywhere.
  **Fix:** accept only `instagram.com` permalinks, or build the link from the handle and
  post id as the fallback at `StoryFetcherClient.java:194` already does.

## P1 — Gaps found running it locally

- [ ] **A failed publish is never retried.** A candidate whose publish throws stays
  `PENDING_REVIEW` with `Could not publish: …` in `review_reasons`
  (`InstagramImportService.java:477`). The only retry path, `findRetryable`
  (`InstagramImportService.java:179`), re-reads stories Claude could not read, not
  candidates that could not publish. Locally every candidate of the first run was lost this
  way because no platform admin existed to own the new clubs
  (`InstagramPublishService.java:223`). Any environment whose first run happens before an
  admin is bootstrapped, production included, loses that run's events.
  **Fix:** retry candidates whose only reasons are publish failures on the next run, or fail
  the run early when no platform admin exists.

- [x] **No way to trigger an import by hand.** Done 2026-11-26: Import now on the admin
  dashboard (`POST /api/v1/admin/instagram/import`) and on a club's dashboard for its own
  account. The `application.yml` comment is true again.

- [ ] **The fetcher URL is not written down anywhere in the repo.** The backend reads only
  `${INSTAGRAM_FETCHER_URL:}`, empty by default, and nothing names Gabriel's gateway, so a
  teammate cannot run the feature without asking. Record where the gateway lives and whether
  `/stories` and `/posts` need `INSTAGRAM_FETCHER_API_KEY` (`/health` does not) in
  `instagram-import.md` and `docker/.env.example`. Do not make it a committed default: every
  clone and CI run would spend credit on one personal account.

## P1 — Reduce the code (do it while V38 is not yet on `develop` and can still be edited)

About 2,650 of the 6,027 added lines are data, tests and docs; the backend production code is
about 3,000. Estimated saving from the items below: 1,500 lines or more.

- [ ] **Remove the review flow nothing uses.** Written for an admin endpoint that is not in
  the diff: the review columns in V38 (`reviewed_by`, `reviewed_at`, `rejection_reason`)
  and the `REJECTED` status
  (`V38__create_instagram_import_tables.sql:100`); repository methods
  `findWithDetailsById`, `findByStatusInOrderByCreatedAtDesc`, `countByStatus`,
  `countByEnabledTrue`, `countByClubIsNotNull`, `findAllByOrderByPriorityAsc`,
  `findAllByOrderByStartedAtDesc`, `findByHandle`; `isRunning`, `model()` and
  `MediaKeys.isInstagramStory`. The `extractor.isConfigured()` branch at
  `InstagramImportService.java:327` can never run.
  Coordinate with the dashboard extraction buttons first: keep whatever that work will call.

- [ ] **Let the gateway return one normalized format.** `StoryFetcherClient` (347 lines)
  parses two raw shapes, Instagram's story JSON and Apify's post JSON. Gabriel owns the
  gateway; if it returns one flat list of items (handle, kind, permalink, media URLs, caption,
  taken-at, expires-at), the parser and its 364 lines of fixtures shrink to a fraction, and
  Apify format changes stay on the gateway's side.

- [x] **Ship a ranked account list instead of ranking at runtime.** Done 2026-11-25: Arpan
  ranked `mcgill-accounts.csv` by hand (461 accounts, with a `category` column), and
  `InstagramSourceSeeder` now loads it in file order and enables the first `max-accounts`,
  without calling the ranker. On Arpan's word no test asserts the CSV's order:
  `bundledAccountsFollowClubCategoryOrder` was deleted, and `InstagramSourceSeederTest`
  checks only the enable cutoff, duplicates and the already-seeded no-op.
- [ ] **Decide whether `InstagramAccountRanker` goes.** Kept on Arpan's word, but it has no
  caller now (188 lines plus its test). Delete it once nobody needs runtime scoring, or the
  admin page that would use it is built. Also check with the
  [`database-lifecycle`](../../.claude/skills/database-lifecycle/SKILL.md) skill whether the
  account seed belongs in a seeder at all.
- [ ] **A database seeded before the re-rank keeps the old order.** The seeder runs only
  when `instagram_sources` is empty, so a local database that ran the import before
  2026-11-25 still holds the 1,275 runtime-ranked accounts. Clear the Instagram tables to
  pick up the new list; production has never run the import.

- [ ] **Move video frame extraction to the gateway, or drop it.** See the ffmpeg item below.

## P2 — Smaller defects (from the review)

- [ ] **Imported images and story rows are kept forever.** Every fetched image goes under
  `instagram-imports/` and `instagram_stories` rows are never deleted, though most are not
  events; a published event also keeps a second copy — `InstagramImportService.java:366`.
  About 30 GB a year in S3 at 200 accounts. **Fix:** delete image and row after processing
  (for example after `expires_at` plus a grace period), or download only what Claude has
  classified as an event.

- [ ] **The ffmpeg timeout never applies, and ffmpeg is not installed.** `transferTo` blocks
  until ffmpeg closes its output, so `waitFor(60s)` only runs after it exits —
  `StoryMediaDownloader.java:83`. A corrupt mp4 hangs a worker for the life of the JVM. The
  Docker image has no ffmpeg, yet `video-frames` defaults to 4, so extraction always fails
  quietly. **Fix:** drain output on another thread or redirect to discard before `waitFor`;
  install ffmpeg or default `video-frames` to 0.

- [ ] **A capacity range is stored as one number.** `parseCapacity` strips every non-digit,
  so 50-100 becomes 50100 — `CandidateRules.java:93`. **Fix:** take the first whole number,
  for example with `\d[\d,]*`.

- [ ] **Two comments describe the wrong code.** `instagramStory()` was inserted between
  `belongsToClub`'s javadoc and the method — `MediaKeys.java:62`. `Event.java:77` says the
  source columns come from V40; they are V39. The V38 comment says an account without a
  club never auto-publishes, but `InstagramPublishService.clubFor` creates a club and
  publishes.

- [ ] **Check the recorded gateway responses for personal data.**
  `backend/src/test/resources/instagram/stories-response.json` and `posts-response.json`
  were recorded from live Instagram. Confirm they hold only public club accounts before the
  branch is public.

## P2 — Process and docs

- [ ] **Write a Proposed ADR and approve the spec.** Events now publish with no human
  review, and fetching depends on an external gateway outside this repo — both real choices,
  and `docs/decisions/` has no ADR for either. The spec is still draft
  (`2026-11-25-instagram-auto-import.md:3`), with two open questions for Arpan: whether
  imported clubs should be owned by the platform admin or go through the claim flow, and
  whether imported events get a visible Instagram marker.

- [ ] **Update the docs the merge left behind.** `check-docs.mjs` flagged them on the merge
  commit: [`connecting-s3.md`](../architecture/connecting-s3.md) and the `s3-media` skill
  (new `instagram-imports/` keys in `MediaKeys`), `ci-cd-pipeline.md` (`pom.xml`, compose,
  `.env.example`, `next.config.ts`), and the rules files `db-migrations`, `contracts`,
  `frontend`, `ci-and-build` and `aws-handling`. Update each, or re-stamp it if the change
  does not affect it. Gabriel's own [`instagram-import.md`](../architecture/instagram-import.md)
  has no `Code as of:` stamp at all; re-read it against the code after the fixes above and
  stamp it then, not before.

- [x] **Run `node scripts/verify.mjs` on the merged branch.** 2026-11-25: the first `--full`
  run was red on `InstagramAccountRankerTest.bundledAccountsFollowClubCategoryOrder` (Gabriel's
  ranker disagreed with his own test), so the ITs never ran. After the seeder stopped using
  the ranker, `--all --full` is green: lint, types, Jest, build, migration lint, backend unit
  tests and 340 ITs.
