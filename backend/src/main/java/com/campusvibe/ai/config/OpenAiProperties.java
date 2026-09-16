package com.campusvibe.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * Typed configuration for the OpenAI provider.
 *
 * <p>Every value is externalised, so the same build artifact runs unchanged in
 * local development (values from {@code docker/.env}) and in production (values
 * from Elastic Beanstalk environment properties). Only the source of the values
 * differs; the variable names never do.
 *
 * <p>The API key is deliberately optional: a blank key means "run search in
 * keyword-only mode", which is the graceful degradation
 * {@link com.campusvibe.search.EmbeddingService} requires. The planner, the
 * first generative feature, fails fast instead: without a key it answers 503
 * rather than an ungrounded or empty reply.
 *
 * <p>Never expose this record through a controller or serialise it into a
 * response — {@link #toString()} is overridden to redact the key, but the
 * accessor is still public to the code that needs it.
 */
@ConfigurationProperties(prefix = "campusvibe.ai.openai")
public record OpenAiProperties(

        @DefaultValue("") String apiKey,
        @DefaultValue("text-embedding-3-small") String embeddingModel,
        @DefaultValue("https://api.openai.com") String baseUrl,
        @DefaultValue("2s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout,
        @DefaultValue("2") int maxRetries,
        // The planner's chat model (spec 2026-09-16-planner-backend).
        @DefaultValue("gpt-4.1-mini") String chatModel,
        // A planner answer is a short intro and at most six one-line reasons;
        // the cap bounds the bill for a reply that runs away, and a reply cut
        // off by it fails rather than being stored half-written.
        @DefaultValue("1200") int maxOutputTokens,
        // The whole streamed reply, first byte to last. readTimeout only bounds
        // the wait for response headers, so a stream that stalls part way
        // would otherwise hold its request open indefinitely.
        @DefaultValue("60s") Duration chatTimeout
) {

    /** True when an API key is present and OpenAI calls may be made. */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Redacts the API key. Guards against the key leaking through debug
     * logging, an Actuator endpoint, or an exception message that happens to
     * interpolate this object.
     */
    @Override
    public String toString() {
        return "OpenAiProperties[apiKey=%s, embeddingModel=%s, baseUrl=%s, connectTimeout=%s, readTimeout=%s, maxRetries=%d, chatModel=%s, maxOutputTokens=%d, chatTimeout=%s]"
                .formatted(isConfigured() ? "***redacted***" : "<not set>",
                        embeddingModel, baseUrl, connectTimeout, readTimeout, maxRetries,
                        chatModel, maxOutputTokens, chatTimeout);
    }
}
