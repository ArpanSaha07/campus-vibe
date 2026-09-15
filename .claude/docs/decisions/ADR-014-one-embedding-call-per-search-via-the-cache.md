# ADR-014 — A search costs one embedding call because the query cache joins an in-flight query

**Status:** Proposed
**Date:** 2026-09-14
**Decided in:** the search relevance unit, [`specs/2026-09-14-search-relevance-and-results.md`](../../specs/2026-09-14-search-relevance-and-results.md)
**Participants:** main session · **Approved by:** Arpan chose the option on 2026-09-14; the status is his to move
**Implemented in:** `backend/src/main/java/com/campusvibe/search/QueryEmbeddingCache.java`, 2026-09-14

## Context

The search box's dropdown runs its two searches at the same time, event search and club search, with `Promise.all` in `SearchBar.tsx`. The two endpoints are separate (`EventController.search`, `ClubController.search`), and each asks `QueryEmbeddingCache.embed` for the query's embedding.

The cache used to be a plain check-then-put Caffeine `Cache`. Both requests arrived before either had stored an answer, so both missed and both called OpenAI. Almost every dropdown query is new text (`mach`, `machine`, `machine l`), because the debounce fires on each pause. So in practice nearly every search cost two billed embedding calls instead of one.

Two constraints from [BUG-005](../../bugs/fixed_bugs.md#bug-005) still hold:
- An empty embedding (no API key, or a provider failure) must not be cached, or search is pinned to keyword-only for the whole TTL.
- The search endpoints stay public behind a 30 requests per minute per-IP limit (`SearchRateLimitFilter`).

## Options considered

### Deduplicate in the cache: an async cache that joins an in-flight query — chosen

`QueryEmbeddingCache` holds a Caffeine `AsyncCache`. The first caller for a normalised query stores a future and computes it; a concurrent caller for the same key gets that same future. A future that completes with null or exceptionally is removed by Caffeine, which keeps BUG-005's no-empty-caching rule. The provider call runs on a virtual-thread executor, because Caffeine's default `ForkJoinPool.commonPool` is sized to the CPU count and the call blocks on HTTP for up to its read timeout.

- **Costs:** a slightly more involved cache; one executor to reason about; the dropdown still makes two HTTP requests per search.
- **Gains:**
  - No API, DTO or frontend change.
  - Every concurrent caller is covered, not only the dropdown: the server-rendered results page also searches events and clubs together, and two students may type the same word at once.
  - Covered by `QueryEmbeddingCacheTest.concurrentIdenticalQueriesShareOneProviderCall`.

### A combined endpoint, `GET /api/v1/search`, returning both lists — rejected

`SearchService` would embed the query once and run both hybrid queries, returning `{ events, clubs }`. The dropdown and the results page would each make one request.

- **Gains:** halves the HTTP requests, so it also halves use of the rate-limit budget. Two requests per keystroke pause against 30 per minute is the likelier source of real 429s.
- **Costs:**
  - A new response DTO in `contracts/api-dto-fields.json` and both contract tests.
  - A new limited path in `SearchRateLimitFilter`.
  - A new `searchAll` in `frontend/app/lib/search.ts`.
  - Keeping the two existing endpoints for any other caller.
- **Not taken:** it fixes the bill only for callers that use it, while the cache fix covers every caller with no contract change.

### Leave it — rejected

Every new query costing two calls is the spend BUG-005 exists to bound.

## Decision

A query is embedded at most once at a time. `QueryEmbeddingCache` is a Caffeine `AsyncCache` whose concurrent callers join the in-flight computation, with the provider call on virtual threads. The event and club search endpoints stay separate.

## Consequences

- **Easy:** any future caller that searches several targets at once gets one embedding call for free.
- **Hard:** the dropdown still spends two rate-limit tokens per search.
- **Foreclosed:** nothing. A combined endpoint can still be added later, and the cache dedupe would stay useful underneath it.
- **Cost:** a caller joining a slow provider call waits as long as the first caller does, the same as if it had made the call itself.
- **Scope:** the cache is per JVM, so two backend instances can still each embed the same query once.

## Revisit when

- Dropdown users actually hit the search rate limit. That is the combined endpoint's remaining advantage.
- A third search target joins the dropdown, which would make three requests per search.
- The backend runs more than one instance and duplicate embedding spend across instances matters, which wants a shared cache rather than either option here.
