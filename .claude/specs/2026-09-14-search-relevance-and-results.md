# Search relevance, results page and robustness

**Status:** shipped · **Date:** 2026-09-14 · wrapped up 2026-09-15, uncommitted on `feature/search`

## Goal

Search returns only what a student can still go to and only what is actually related. Past events stop appearing. Meaning-only noise stops appearing: `art expo` used to list Frosh, Entrepreneur Hub and Photography Society. The full results page at `/events?q=` shows the clubs the dropdown already promised, instead of *Nothing matches*. The dropdown no longer re-opens with a stale response. It no longer reports a rate limit as *No matches*. A club rename re-indexes that club's events. Two parallel identical queries cost one OpenAI call, not two.

## Out of scope

- An event update endpoint. There is none, so the rest of [BUG-006](../bugs/fixed_bugs.md#bug-006) stays open until one exists.
- Closing [BUG-001](../bugs/bugs.md#bug-001). **Its root cause was found and fixed inside this unit** (see *Decisions taken*), but the entry says close it on a green GitHub full-tier run, and that is Arpan's call.
- The home page's mock events (`(main)/page.tsx:7-8` reads `data/data.ts`). Search can never find them, and wiring the home page to the API is a separate unit.
- Rewriting [`search.md`](../docs/architecture/search.md). Still queued in `todo.md` (P2); only its banner was corrected.
- Keyboard navigation in the dropdown. Searching anything beyond events and clubs.

## Decisions taken

- The full results page shows events **and** clubs. Arpan, 2026-09-14.
- Past events are **excluded** from search (`date_time >= now()`), not ranked lower. Arpan, 2026-09-14.
- Measure the threshold first, then raise it. Arpan, 2026-09-14.
- **`search.min-score` 0.2 → 0.25, measured, approved by Arpan with the plan, 2026-09-14.** With a 0.7 semantic weight this means a meaning-only match needs cosine ≥ 0.357. Measured on the local stack (15 clubs, 2 events, `text-embedding-3-small`):

  | Query | Kept (cosine) | Dropped (cosine) |
  |---|---|---|
  | machine learning | McGill AI Society 0.424 · AI bootcamp 0.409 · ML club 0.405 | Robotics 0.330 |
  | hackathon | Entrepreneur Hub 0.435 · Coding Club 0.412 · AI bootcamp 0.380 | McGill AI Society 0.287 |
  | art expo | — | Frosh 0.328 · Entrepreneur Hub 0.322 · Photography Society 0.318 |
  | dance party | — | Science Club 0.303 · Drama Troupe 0.289 |
  | photography | Photography Society (keyword) | McGill Atheletics 0.317 |
  | career fair | — | Entrepreneur Hub 0.301 |

  The gap between the noise (≤ 0.33) and real matches (≥ 0.38) is where 0.357 sits. `career fair` → Entrepreneur Hub is the one arguable loss. Keyword hits bypass the gate, as before. The data set is small, so this is a starting value, not a law.
- **One OpenAI call per search, by deduplicating in the cache rather than adding a combined endpoint.** Arpan, 2026-09-14; recorded as [ADR-014](../docs/decisions/ADR-014-one-embedding-call-per-search-via-the-cache.md) (Proposed). `QueryEmbeddingCache` is a Caffeine `AsyncCache`, so a concurrent identical query joins the in-flight future. Empty or failed results are still not cached (BUG-005's rule), because Caffeine drops a future that completes with null. The provider call runs on a virtual-thread executor rather than `ForkJoinPool.commonPool`.
- **BUG-001 root cause, found 2026-09-14 while verifying this unit.** `SearchRepository` formatted the weights into the SQL with `%f`, which follows the JVM's FORMAT locale. This machine's JBR runs `fr_CA`, so `0.7` printed as `0,700000`, and Postgres read the score as three select-list columns. The semantic leg vanished without an error. Proven by in-test diagnostics: cosine 0.7746, embedding present, hybrid result `[]`. Fix: the weights are bound as `?` parameters, and `SearchIT.semanticSearchSurvivesACommaDecimalLocale` forces `fr_CA` so an en_US runner still catches it. Claude, as the fix; the trap is in `rules/backend-java.md`.
- **Locale and time zone are pinned wherever the backend JVM runs.** Arpan, 2026-09-14. Docker already shielded the running app, but only through the Temurin base image's `LANG`. Tests run in the host JVM, where Testcontainers containerises Postgres alone. So:
  - `backend/Dockerfile` sets `JAVA_TOOL_OPTIONS` to en/US/UTC.
  - `backend/pom.xml` gives surefire and failsafe the same, plus the `user.*.format` pair Windows needs.
  - Rejected: the forbiddenapis plugin, about 90 message calls of churn for no other risky call found.
- **The results page uses the `/clubs` page's grid, not `ClubGrid`.** Claude, 2026-09-14: `ClubGrid`'s `auto-fit` columns collapsed to one narrow column there.

## Open questions

None.

## Files changed

- **Search backend:** `SearchRepository.java` (bound weights, past-event filter, `min-score` default), `QueryEmbeddingCache.java` (in-flight dedupe), `SearchIndexService.java` (`indexEventsByOrganizer`), `application.yml` (`search.min-score`).
- **Club backend:** `club/ClubService.java` (`update` re-indexes events on rename).
- **Build and runtime:** `backend/pom.xml` (test JVM `argLine`), `backend/Dockerfile` (`JAVA_TOOL_OPTIONS`).
- **Backend tests:** `SearchIT.java` (past events, rename re-index, comma-decimal locale), `QueryEmbeddingCacheTest.java` (concurrency).
- **Frontend:** `app/(main)/events/page.tsx` (clubs section, combined empty state), `components/SearchBar.tsx` (stale response, 429 and error messages), `__tests__/SearchBar.test.tsx`.
- **Rules:** `rules/backend-java.md`, `rules/ci-and-build.md`, `rules/backend-clubs.md`.
- **Docs:** `bugs/bugs.md`, `TODO/todo.md`, `TODO/tasks-completed.md`, `STATUS.md`, `docs/architecture/search.md` (banner only), `docs/decisions/ADR-014-…` and its index row.

## Verification (as run)

- `node scripts/verify.mjs --full`: all steps pass. Backend: 120 unit tests and 290 integration tests, including `SearchIT` 10/10 and `QueryEmbeddingCacheTest` 8/8. Frontend: lint, type-check, Jest (including `SearchBar` 7/7) and build.
- A throwaway probe test in the pinned surefire JVM on the `fr_CA` machine printed `en_US`, `UTC`, `0.700000`. Deleted afterwards.
- `docker compose up -d --build backend frontend`. The backend logs `Picked up JAVA_TOOL_OPTIONS` and reports `en`/`US`/`UTC`.
- curl:
  - `clubs/search?q=art%20expo` and `?q=dance%20party` return `[]`.
  - `?q=machine%20learning` returns McGill AI Society and ML club.
  - `?q=hackathon` returns Entrepreneur Hub and Coding Club.
  - Event search returns `[]`, since both local events are past.
- Browser on `localhost:3000`:
  - `machine learning`: the dropdown shows 2 clubs, and Enter opens a results page with club cards side by side.
  - `art expo`: *No matches*.
  - `ma` typed and deleted quickly: the panel stays closed.
  - No console errors after reload.

## Wrap-up (done 2026-09-15)

- `bugs/bugs.md`: BUG-001 root cause recorded, left OPEN until a GitHub run. BUG-006 narrowed to the missing event update endpoint.
- `rules/backend-java.md` (bind numbers), `rules/ci-and-build.md` (locale pins), `rules/backend-clubs.md` (rename re-indexes events).
- `TODO/todo.md`, `TODO/tasks-completed.md`, `STATUS.md`.
- `docs/architecture/search.md`: banner corrected; the rewrite stays queued.
- ADR-014 (Proposed) for the cache dedupe. The locale pin is listed under *Decided without an ADR*, as forced by BUG-001.
