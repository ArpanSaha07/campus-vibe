# Instagram auto-import

**Code as of:** `3ab5901` plus the uncommitted club dashboard and admin import controls unit, 2026-11-26.

How events get from McGill club Instagram accounts onto CampusVibe without anyone
typing them in. Spec: [2026-11-25-instagram-auto-import](../specs/2026-11-25-instagram-auto-import.md)
(draft; it ruled out an admin screen and club self-service, both of which now exist, see
*Who decides what is checked*). Code: `backend/src/main/java/com/campusvibe/instagram/`.

## The pipeline

```
accounts (instagram_sources: the first N by priority, plus club opt-ins)
  -> StoryFetcherClient  POST {fetcher}/stories   twice a day
                         POST {fetcher}/posts     once per 20h, newest 3 per account
  -> instagram_stories   one row per story or post; full-size image copied to
                         S3 under instagram-imports/ (Instagram URLs expire)
  -> ClaudeStoryEventExtractor   image + carousel slides or video frames + caption
                                 -> StoryExtraction (structured output)
  -> instagram_event_candidates  one row per event Claude found
  -> CandidateRules.publishBlockers + duplicate checks
  -> InstagramPublishService     EventService.create, banner, club, source link
```

`InstagramImportService` runs it. `InstagramImportScheduler` triggers it at 9:00 and
21:00 Montreal (`campusvibe.instagram.cron`), and once at startup when the last run
over the list is older than `startup-stale-after` (a club's single-account run does
not count: `findFirstBySourceIdIsNullOrderByStartedAtDesc`). Stories live 24 hours,
so two runs 12 hours apart see every story once. An interval setting for the admin
was considered and set aside (Arpan, 2026-11-26); the schedule is fixed.

A platform admin can also start a run over the list from the admin dashboard, and a
club can import its own account from its dashboard; both are below.

## What decides that something is an event

Claude, and only Claude. The system prompt in `ClaudeStoryEventExtractor` lists
what counts (something students can show up to at a stated date) and what does
not (membership or merch sales, recruitment, spotlights, recaps, menus). The
schema in `StoryExtraction` asks for the title as it should be printed, a
card-length summary, a detailed description, highlight bullets, the audience,
collaborators, local Montreal date and time strings, venue, price, capacity,
registration link, tags from the live taxonomy, and a confidence.

The backend turns local times into instants itself (`CandidateRules.resolveTimes`)
so the model never does time-zone arithmetic. A date with no time publishes as an
all-day event and says so; a missing end time becomes start plus two hours and
says so.

`CandidateRules.publishBlockers` holds back anything that is not an upcoming event
or reminder, below `auto-publish.min-confidence` (0.7), already over, more than six
months away (a misread year), unsure about its date, or possibly cancelled. Held
candidates stay in the table, unpublished.

Without `ANTHROPIC_API_KEY` a run stops before fetching anything (it would only
spend fetcher credit) and records why in `instagram_import_runs.error`. A rules-based OCR fallback was tried and removed: it published things
that were not events.

## Duplicates and enrichment

The same event arrives many times: a story and a post, a reminder, four clubs
resharing one poster. `markDuplicate` treats two as one when:

- they start within 30 minutes and their titles are similar
  (`CandidateRules.titleSimilarity` at least 0.5);
- they start hours apart (up to 12) and their titles are near identical (0.8).
  Two games against the same team at 6 and 8 pm are two events;
- one has a date but no time and the titles are similar on the same day, so a
  TONIGHT reminder matches the 8 pm show it is about;
- they share a time slot (30 minutes) and a venue (`sameSlot`);
- they come from two reshares of one post and also agree on the time and roughly
  the name. A reshared post can list a whole week of events, so the shared post
  alone is never enough.

One story or post yields at most 12 events, enough for a schedule.

These rules came from a preview run on 2026-11-25 (20 accounts, 105 stories and
posts, 42 events published), which showed a reshared week calendar collapsing
into one event and a six-game schedule losing its last game. A duplicate of a published event is
not wasted: `InstagramPublishService.enrich` fills what the event lacked (venue,
price, capacity, banner) and appends highlights it did not have. It never
overwrites.

## Clubs, links and images

An event needs a club. `InstagramPublishService.clubFor` links the account to a
club whose contact links already name it, else creates one named after the
account and owned by the oldest platform admin (ADR-004: never ownerless).

**A reposted event goes to its host's club, not the club that shared it**
(Arpan, 2026-11-26). Clubs share each other's posters in their stories all the
time; the 2026-11-26 local runs had 27 reposts among 68 candidates, every one
filed under the sharing club. Claude returns the host's handle
(`StoryExtraction.hostHandle`) as written on the reshared card, a mention sticker,
the poster or the caption, and is given the story's mentions (stored since V43, so
a retried story keeps them). `CandidateRules.verifiedHostHandle` accepts it only if
the story itself shows it, as a mention or a whole token in the image text or
caption, and never the posting account; otherwise the event stays with the poster.
That check is what stops a guessed handle, or one planted in a caption, from moving
an event to any club. A verified handle is kept on the candidate (`host_handle`,
V44) and `publish` uses `hostClub`, which finds or creates the host's club the same
way, adding the host to the end of the ranked list when it is new. The fetcher does
not say who posted a reshared post (only its `media_code`), which is why the handle
comes from what Claude reads. `InstagramHostBackfill` ran the same check once over
candidates from before V44 and moved their published events (Arpan: move existing
too); locally it moved 11 and created 10 host clubs.

`events.source_url` (V39) is the permanent link: the post, or for a story the post
it reshared or the account profile. A story also keeps its own link and expiry;
`Event.currentSourceUrl` returns the story while it is up. `EventDTO.sourceUrl`
carries it. **The card opens the event page, like every other card**, and the
event page offers View on Instagram (Arpan, 2026-11-26; until then the card opened
Instagram in a new tab). An event page needs nothing created for it: it is built
from the event row on each request, so a published event has one at once.

The banner is our full-resolution copy of the image, over a blurred copy of itself.
`EventPoster` shows it two ways. On the event page banner it is whole
(object-contain), because posters are portrait and the frame is landscape. On the
card (`fit="card"`) it fills a centred box 80% of the frame's width, cropped top and
bottom and anchored to the top (Arpan, 2026-11-26): whole, it was a third of the card
wide. The card keeps its 160px image area, so text near a poster's bottom edge can be
cut off there.

## Who decides what is checked

Three parties, and the order they override each other in is the design (Arpan,
2026-11-26: clubs override the admin's N).

- **The platform admin sets N** on the admin dashboard
  (`AdminInstagramController`, `PUT /api/v1/admin/instagram/account-count`). Every run
  over the list checks the first N accounts of the ranked list. N lives in
  `instagram_import_settings` (V42, one row); until an admin saves one,
  `max-accounts` answers.
- **A club overrides N for its own account** from its dashboard
  (`/manage/[clubId]/instagram`, `ClubInstagramController`). Auto-import on sets
  `club_opted_in` (V40), which N never drops; off sets `enabled = false`, which skips
  the account even inside N. Connecting without touching the toggle changes neither.
  The toggle shows the outcome, whether scheduled runs will check the account
  (`ClubInstagramService.scheduled`), not the flag.
- **`enabled = false` means one thing: a club turned auto-import off.** The ranked
  list is `findRanked`: every account except off-and-club-linked, in priority order.
  The seeder used to switch off every row past the old cap; it now seeds all rows on
  and, on a list already loaded, switches back on any row that is off and linked to
  no club (`enableUnclaimedDisabled`). A row off for the old reason, once the importer
  linked it to a club, would otherwise read as a club's choice and drop out.

**A club's handle is stored once**, in its contact links (`social_links.instagram`),
the same value the Edit Club page edits. Saving it on the Instagram page goes through
`ClubService.update`, so `ClubSocialLinks.normalise` checks it, and links the
`instagram_sources` row for that handle to the club, creating one at the end of the
list if the handle is new. A handle already linked to another club is refused (409).
That includes the placeholder clubs `clubFor` creates, which is the open owner
question in the cleanup todo. **Saving never imports.**

## Import now

Two buttons, deliberately different.

- **Admin** (`POST /api/v1/admin/instagram/import`): the scheduled run, started now,
  over the same first N plus opt-ins, under the same lease, so the two never overlap.
  409 while a run holds the lease. The admin section lists the last ten runs of every
  kind (`InstagramImportRunDTO`).
- **Club** (`POST /api/v1/clubs/{id}/instagram/import`, owners and admins alike):
  `startSourceRun` fetches that one handle and nothing else, on its own executor
  (`clubRunner`), **without the lease**, so a club never waits out a run over the
  whole list. Overlapping one is safe: a story is unique per (source, external id)
  and candidate creation is serialized. The run row carries `source_id` (V41), which
  is how the club page shows its own run and only its own. Posts are always fetched
  for that account, but the run is not marked `included_posts`, which would tell
  `postsDue` the whole list had its posts read. The stored retry backlog is left to
  the scheduled run.
- **The club cooldown is the claim.** One conditional UPDATE stamps
  `last_fetch_at` only when the last fetch, by any run, is over an hour old, so two
  clicks or two instances cannot both start. A run that fails outright, including
  one whose every fetch failed, hands the hour back.

## Configuration

All under `campusvibe.instagram` in `application.yml`; the ones an environment
must set:

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Required for anything to publish |
| `INSTAGRAM_FETCHER_URL` | The Apify gateway; blank disables fetching |
| `INSTAGRAM_FETCHER_API_KEY` | Sent as x-api-key when set |
| `INSTAGRAM_IMPORT_ENABLED` | The schedule and the startup run; both Import now buttons work without it |

Costs per run, measured 2026-11-25: about $0.78 of fetcher credit for 200 accounts'
stories, $1.40 for their posts (once a day), and Claude Haiku tokens for each new
image.

## Accounts

`InstagramSourceSeeder` loads `instagram/mcgill-accounts.csv` once, when no
accounts exist, **in file order**: the CSV is ranked by hand (Arpan, 2026-11-25,
461 accounts), so a row's position is its priority and a run checks the first N
(the admin's account count, above). Every row is seeded on. A `category` column records the grouping: computer science, cultural,
sports, academic/professional, arts/media, hobbies/social, community/advocacy,
faith/wellness, university/other, then accounts with SSMU in their handle. Clubs
discovered through SSMU's directory still belong to their activity category. The
seeder skips a handle outside Instagram's alphabet and a repeated one. No test
asserts the list's order — it is Arpan's to edit. Editing this seed file does not
update priorities for accounts already stored in the database.

`InstagramAccountRanker` is kept but no longer called. It scored accounts at
runtime from the source page and handle (with an optional `rank` column ahead of
the score) and disagreed with the hand-ranked list.

## Security

Fetcher answers are untrusted: only stories from requested handles are kept, and
`StoryMediaDownloader` downloads only https from Instagram's CDN hosts, with no
redirects and a size cap (SSRF). Image bytes are checked by signature. Captions
and image text are data to Claude, never instructions. Stored links must be https
(V39 CHECK constraints) because they reach an href.
