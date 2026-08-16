package com.campusvibe.search;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

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
 * <p>A miss that returns empty — no API key configured, or a provider failure —
 * is <b>not</b> cached. Caching it would pin search into keyword-only mode for
 * the whole TTL after a single blip.
 */
@Component
public class QueryEmbeddingCache {

    private final EmbeddingService embeddingService;
    private final Cache<String, float[]> cache;

    public QueryEmbeddingCache(
            EmbeddingService embeddingService,
            @Value("${search.query-embedding-cache.max-entries:1000}") int maxEntries,
            @Value("${search.query-embedding-cache.ttl:1h}") Duration ttl) {
        this.embeddingService = embeddingService;
        this.cache = Caffeine.newBuilder()
                .maximumSize(maxEntries)
                .expireAfterWrite(ttl)
                .build();
    }

    public Optional<float[]> embed(String query) {
        if (query == null || query.isBlank()) return Optional.empty();

        String key = normalise(query);
        float[] hit = cache.getIfPresent(key);
        if (hit != null) return Optional.of(hit);

        Optional<float[]> fresh = embeddingService.embed(query);
        fresh.ifPresent(vector -> cache.put(key, vector));
        return fresh;
    }

    private static String normalise(String query) {
        return query.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    /** Test seam. */
    public void clear() {
        cache.invalidateAll();
    }

    /** Test seam: how many distinct queries are held. */
    public long size() {
        cache.cleanUp();
        return cache.estimatedSize();
    }
}
