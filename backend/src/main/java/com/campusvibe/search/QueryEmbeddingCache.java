package com.campusvibe.search;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executors;

/**
 * Caches embeddings of *search queries* ([BUG-005]).
 *
 * <p>Document embeddings already persist in pgvector, but query embeddings were
 * recomputed on every request — including the identical repeats that a search
 * box produces constantly, both from one user refining a term and from every
 * user searching the same few popular words.
 *
 * <p>Keyed on the query lowercased and whitespace-collapsed, so {@code Chess
 * Club} and {@code chess  club} share one entry. That is safe because the key is
 * only ever used to look up an embedding of that same text; it is not a search
 * result, and no per-user state is involved.
 *
 * <p>Deliberately <b>not</b> the Next data cache or a `@Cacheable` on the
 * service: this must sit around the *provider call only*, not around the ranked
 * results, which change whenever an event is added and must never be served
 * stale.
 *
 * <p>An <b>async</b> cache, so a query already being embedded is joined rather
 * than embedded again. The search box fires the event and club searches at the
 * same moment, and nearly every query it sends is new, so a plain
 * check-then-put cache let both miss and paid the provider twice per search.
 *
 * <p>A miss that returns empty — no API key configured, or a provider failure —
 * is <b>not</b> cached. Caffeine drops an entry whose future completes with null
 * or exceptionally; caching it would pin search into keyword-only mode for the
 * whole TTL after a single blip.
 */
@Component
public class QueryEmbeddingCache {

    private final EmbeddingService embeddingService;
    private final AsyncCache<String, float[]> cache;

    public QueryEmbeddingCache(
            EmbeddingService embeddingService,
            @Value("${search.query-embedding-cache.max-entries:1000}") int maxEntries,
            @Value("${search.query-embedding-cache.ttl:1h}") Duration ttl) {
        this.embeddingService = embeddingService;
        this.cache = Caffeine.newBuilder()
                .maximumSize(maxEntries)
                .expireAfterWrite(ttl)
                // The provider call blocks on HTTP for up to its read timeout.
                // Caffeine's default executor is ForkJoinPool.commonPool, which
                // is sized to the CPU count and shared by the whole JVM.
                .executor(Executors.newVirtualThreadPerTaskExecutor())
                .buildAsync();
    }

    public Optional<float[]> embed(String query) {
        if (query == null || query.isBlank()) return Optional.empty();

        try {
            return Optional.ofNullable(cache.get(normalise(query),
                    key -> embeddingService.embed(query).orElse(null)).join());
        } catch (CompletionException e) {
            return Optional.empty();
        }
    }

    private static String normalise(String query) {
        return query.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** Test seam. */
    public void clear() {
        cache.synchronous().invalidateAll();
    }

    /** Test seam: how many distinct queries are held. */
    public long size() {
        cache.synchronous().cleanUp();
        return cache.synchronous().estimatedSize();
    }
}
