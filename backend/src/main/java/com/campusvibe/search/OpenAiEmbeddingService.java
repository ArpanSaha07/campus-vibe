package com.campusvibe.search;

import com.campusvibe.ai.client.OpenAiEmbeddingClient;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Adapts the provider-neutral {@link EmbeddingService} contract onto the
 * OpenAI client.
 *
 * <p>Intentionally thin: authentication, timeouts, retries, error translation
 * and usage logging all live in
 * {@link com.campusvibe.ai.client.OpenAiEmbeddingClient}, so swapping providers
 * means adding a client and a sibling adapter rather than touching search.
 */
@Service
public class OpenAiEmbeddingService implements EmbeddingService {

    private static final String FEATURE = "search-embedding";

    private final OpenAiEmbeddingClient client;

    public OpenAiEmbeddingService(OpenAiEmbeddingClient client) {
        this.client = client;
    }

    @Override
    public boolean isEnabled() {
        return client.isConfigured();
    }

    @Override
    public Optional<float[]> embed(String text) {
        return client.embed(FEATURE, text);
    }
}
