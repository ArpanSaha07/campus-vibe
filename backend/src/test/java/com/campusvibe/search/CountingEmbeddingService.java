package com.campusvibe.search;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Stands in for the real provider and counts calls.
 *
 * <p>The whole point of {@link QueryEmbeddingCache} is *not making the call*, so
 * a test that cannot see the call count cannot test it. With no API key
 * configured the real {@code EmbeddingService} returns empty and caches nothing,
 * which would let a broken cache pass unnoticed.
 */
public class CountingEmbeddingService implements EmbeddingService {

    private final AtomicInteger calls = new AtomicInteger();

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public Optional<float[]> embed(String text) {
        calls.incrementAndGet();
        // Shape does not matter here; only that it is present, so the cache
        // stores it. The vector is deterministic so nothing depends on timing.
        return Optional.of(new float[] {0.1f, 0.2f, 0.3f});
    }

    public int calls() {
        return calls.get();
    }

    public void reset() {
        calls.set(0);
    }
}
