package com.campusvibe.search;

import java.util.Optional;

/**
 * Turns text into a vector embedding. Implementations must degrade gracefully:
 * return {@link Optional#empty()} when no provider is configured or a call
 * fails, so search falls back to keyword-only mode instead of breaking.
 */
public interface EmbeddingService {

    boolean isEnabled();

    Optional<float[]> embed(String text);
}
