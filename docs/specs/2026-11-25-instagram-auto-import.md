# Instagram auto-import

**Status:** draft · **Date:** 2026-11-25

## Goal

Events from McGill club Instagram accounts appear on CampusVibe with no one typing
them in. Twice a day the backend fetches the stories, and once a day the newest
posts, of the top 200 McGill accounts; Claude reads each image and caption, decides
whether it announces a real upcoming event, and extracts everything a student
needs. Real events publish on their own; the card opens the post or story on
Instagram.

## Out of scope

- Any admin or review screen. There is no queue to approve; Claude decides.
- Club-admin self-service for linking their own Instagram account.
- Cleanup of staged images (instagram-imports/) after a retention period.
- A dedicated registration-URL or category field on events.

## Decisions taken

- Fully automatic publishing, no human review (Gabriel, 2026-11-25).
- No admin UI; the homepage keeps its rows (Popular this weekend, Workshops,
  Outdoors) filled with real events instead of the demo list (Gabriel).
- Clicking an imported event card opens Instagram: the post, else the story while
  it is up, else the reshared post or the account profile (Gabriel).
- The whole poster is shown, never cropped or stretched, at the existing card
  and banner sizes (Gabriel).
- Only Claude decides what is an event. Without ANTHROPIC_API_KEY a run fetches
  nothing and publishes nothing; a rules-based OCR fallback was tried and removed
  because it published non-events (Gabriel).
- Fetching goes through the team's Apify gateway (one $5-capped key per account,
  for usage tracking and leak containment) behind INSTAGRAM_FETCHER_URL.
- An account with no club gets one automatically, matched by the Instagram link
  in an existing club's contact links, else created and owned by the oldest
  platform admin. ADR-004 still holds: no club is ever ownerless.
- Accounts come from the discovery CSV, ranked by source page and handle
  (InstagramAccountRanker); the top 200 eligible are watched.

## Open questions

- Arpan: whether imported clubs owned by the platform admin is the right owner, or
  whether they should go through the existing claim flow instead.
- Arpan: whether imported events should be visually marked as coming from
  Instagram beyond the card link.
- Production needs ANTHROPIC_API_KEY, INSTAGRAM_FETCHER_URL and
  INSTAGRAM_IMPORT_ENABLED set on Elastic Beanstalk.

## Files expected to change

- backend/src/main/java/com/campusvibe/instagram/ (new package)
- backend/src/main/resources/db/migrations/V38, V39
- backend/src/main/java/com/campusvibe/event/ (Event source link, EventDTO.sourceUrl)
- contracts/api-dto-fields.json (EventDTO.sourceUrl) and both contract tests
- frontend/app/components/event/EventCard.tsx, EventPoster.tsx, the event page
- frontend/app/(main)/page.tsx, components/main-page/LiveEventSection.tsx
- docs/architecture/instagram-import.md, scripts/docs-map.json

## Verification

- node scripts/verify.mjs --all
- Locally, with ANTHROPIC_API_KEY and INSTAGRAM_FETCHER_URL set and
  INSTAGRAM_IMPORT_ENABLED=true: start the backend, wait for the startup run in
  instagram_import_runs, then check / and /events show imported events whose
  cards open Instagram.
