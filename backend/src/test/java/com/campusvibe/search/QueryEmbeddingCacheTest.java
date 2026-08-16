package com.campusvibe.search;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The query-embedding cache from [BUG-005], in isolation.
 *
 * <p>A unit test rather than an integration one: what matters is how many times
 * the provider is called, and that is invisible through HTTP.
 */
class QueryEmbeddingCacheTest {

    private CountingEmbeddingService provider;
    private QueryEmbeddingCache cache;

    @BeforeEach
    void setUp() {
        provider = new CountingEmbeddingService();
        cache = new QueryEmbeddingCache(provider, 100, Duration.ofHours(1));
    }

    @Test
    void identicalQueriesCostOneProviderCall() {
        cache.embed("chess club");
        cache.embed("chess club");
        cache.embed("chess club");

        assertEquals(1, provider.calls(),
                "repeat queries are the common case for a search box; each miss is billed");
    }

    @Test
    void theKeyIgnoresCaseAndCollapsesWhitespace() {
        cache.embed("Chess   Club");
        cache.embed("chess club");
        cache.embed("  CHESS Club  ");

        assertEquals(1, provider.calls());
    }

    @Test
    void differentQueriesAreCachedSeparately() {
        cache.embed("chess");
        cache.embed("football");

        assertEquals(2, provider.calls());
        assertEquals(2, cache.size());
    }

    @Test
    void theCachedVectorIsReturnedUnchanged() {
        Optional<float[]> first = cache.embed("chess");
        Optional<float[]> second = cache.embed("chess");

        assertTrue(first.isPresent());
        assertTrue(second.isPresent());
        assertArrayEquals(first.get(), second.get());
    }

    @Test
    void blankAndNullQueriesNeverReachTheProvider() {
        assertTrue(cache.embed(null).isEmpty());
        assertTrue(cache.embed("").isEmpty());
        assertTrue(cache.embed("   ").isEmpty());

        assertEquals(0, provider.calls());
    }

    @Test
    void anEmptyAnswerIsNotCached() {
        // A provider failure or a missing API key must not pin search into
        // keyword-only mode for the whole TTL. The next request tries again.
        EmbeddingService alwaysEmpty = new EmbeddingService() {
            int calls = 0;
            @Override public boolean isEnabled() { return false; }
            @Override public Optional<float[]> embed(String text) {
                calls++;
                return Optional.empty();
            }
            @Override public String toString() { return String.valueOf(calls); }
        };
        QueryEmbeddingCache failing = new QueryEmbeddingCache(alwaysEmpty, 100, Duration.ofHours(1));

        assertTrue(failing.embed("chess").isEmpty());
        assertTrue(failing.embed("chess").isEmpty());

        assertEquals(0, failing.size(), "an empty answer must not occupy a cache entry");
        assertEquals("2", alwaysEmpty.toString(), "the second call must retry, not serve a cached miss");
    }

    @Test
    void theCacheIsBounded() {
        QueryEmbeddingCache small = new QueryEmbeddingCache(provider, 10, Duration.ofHours(1));
        for (int i = 0; i < 200; i++) {
            small.embed("query number " + i);
        }
        // Caffeine evicts asynchronously, so this is an upper bound rather than
        // an exact figure. The point is that an attacker cannot grow it without
        // limit by varying the query.
        assertTrue(small.size() <= 20, "expected bounded, was " + small.size());
    }
}
