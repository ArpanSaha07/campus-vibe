# Instagram auto-import

How events get from McGill club Instagram accounts onto CampusVibe without anyone
typing them in. Spec: [2026-11-25-instagram-auto-import](../specs/2026-11-25-instagram-auto-import.md).
Code: `backend/src/main/java/com/campusvibe/instagram/`.

## The pipeline

```
accounts (instagram_sources, top 200 enabled by priority)
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
is older than `startup-stale-after`. Stories live 24 hours, so two runs 12 hours
apart see every story once.

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

`events.source_url` (V39) is the permanent link: the post, or for a story the post
it reshared or the account profile. A story also keeps its own link and expiry;
`Event.currentSourceUrl` returns the story while it is up. `EventDTO.sourceUrl`
carries it, and `EventCard` opens it in a new tab instead of the event page.

The banner is our full-resolution copy of the image. `EventPoster` shows it whole
(object-contain over a blurred copy of itself) in the frame the card always had,
because posters are portrait and the frames are landscape.

## Configuration

All under `campusvibe.instagram` in `application.yml`; the ones an environment
must set:

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Required for anything to publish |
| `INSTAGRAM_FETCHER_URL` | The Apify gateway; blank disables fetching |
| `INSTAGRAM_FETCHER_API_KEY` | Sent as x-api-key when set |
| `INSTAGRAM_IMPORT_ENABLED` | The schedule and the startup run |

Costs per run, measured 2026-11-25: about $0.78 of fetcher credit for 200 accounts'
stories, $1.40 for their posts (once a day), and Claude Haiku tokens for each new
image.

## Accounts

`InstagramSourceSeeder` loads `instagram/mcgill-accounts.csv` once, when no
accounts exist, **in file order**: the CSV is ranked by hand (Arpan, 2026-11-25,
461 accounts), so a row's position is its priority and the first `max-accounts`
are watched. A `category` column records the grouping: computer science, cultural,
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
