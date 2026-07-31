package com.campusvibe.ai.client;

import com.campusvibe.ai.config.OpenAiProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Encapsulates all OpenAI-specific embedding communication: authentication,
 * request shape, response deserialisation, retries, error translation and
 * usage logging.
 *
 * <p>No caller outside this package knows that OpenAI is the provider or that
 * an API key exists. Callers depend on
 * {@link com.campusvibe.search.EmbeddingService}, which this client backs.
 *
 * <p>Failures never propagate: every path returns {@link Optional#empty()} so
 * that search degrades to keyword-only rather than breaking. Provider error
 * bodies are never logged or surfaced, only status codes.
 */
@Component
public class OpenAiEmbeddingClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingClient.class);
    private static final Duration INITIAL_BACKOFF = Duration.ofMillis(200);
    private static final int RATE_LIMITED = 429;
    private static final int UNAUTHORIZED = 401;

    private final RestClient restClient;
    private final OpenAiProperties properties;

    public OpenAiEmbeddingClient(RestClient openAiRestClient, OpenAiProperties properties) {
        this.restClient = openAiRestClient;
        this.properties = properties;
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    /**
     * Embeds a single string.
     *
     * @param feature short label for the calling feature, used only for usage
     *                logging (for example {@code "search-query"})
     * @return the embedding, or empty if OpenAI is unconfigured or the call
     *         could not be completed
     */
    public Optional<float[]> embed(String feature, String text) {
        if (!isConfigured() || text == null || text.isBlank()) {
            return Optional.empty();
        }

        int maxAttempts = Math.max(0, properties.maxRetries()) + 1;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            long startedAt = System.nanoTime();
            try {
                EmbeddingResponse response = restClient.post()
                        .uri("/v1/embeddings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("model", properties.embeddingModel(), "input", text))
                        .retrieve()
                        .body(EmbeddingResponse.class);

                logUsage(feature, startedAt, response);
                return toVector(response);

            } catch (HttpClientErrorException e) {
                int status = e.getStatusCode().value();

                // 429 is transient and worth retrying. Every other 4xx is a
                // request or credential defect that retrying cannot fix.
                if (status == RATE_LIMITED && attempt < maxAttempts) {
                    backOff(attempt);
                    continue;
                }
                if (status == UNAUTHORIZED) {
                    log.error("OpenAI rejected the API key (HTTP 401) for feature [{}]. "
                            + "Check the OPENAI_API_KEY environment variable. Falling back to keyword-only search.",
                            feature);
                } else {
                    log.warn("OpenAI request for feature [{}] failed with HTTP {}; falling back to keyword-only search",
                            feature, status);
                }
                return Optional.empty();

            } catch (HttpServerErrorException | ResourceAccessException e) {
                // Provider outage or network/timeout failure — both transient.
                if (attempt < maxAttempts) {
                    backOff(attempt);
                    continue;
                }
                log.warn("OpenAI request for feature [{}] failed after {} attempt(s) ({}); "
                        + "falling back to keyword-only search",
                        feature, maxAttempts, e.getClass().getSimpleName());
                return Optional.empty();

            } catch (Exception e) {
                // Deterministic failures such as malformed responses: no retry.
                log.warn("OpenAI request for feature [{}] could not be processed ({}); "
                        + "falling back to keyword-only search",
                        feature, e.getClass().getSimpleName());
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    private Optional<float[]> toVector(EmbeddingResponse response) {
        if (response == null || response.data() == null || response.data().isEmpty()) {
            return Optional.empty();
        }
        List<Double> values = response.data().get(0).embedding();
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }
        float[] embedding = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            embedding[i] = values.get(i).floatValue();
        }
        return Optional.of(embedding);
    }

    /** Operational metadata only — never the prompt text and never the key. */
    private void logUsage(String feature, long startedAt, EmbeddingResponse response) {
        long latencyMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        int totalTokens = response != null && response.usage() != null ? response.usage().totalTokens() : -1;
        log.info("ai.usage feature={} provider=openai model={} latencyMs={} totalTokens={}",
                feature, properties.embeddingModel(), latencyMs, totalTokens);
    }

    /** Exponential backoff with jitter, to avoid synchronised retry storms. */
    private void backOff(int attempt) {
        long baseMillis = INITIAL_BACKOFF.toMillis() * (1L << (attempt - 1));
        long jitterMillis = ThreadLocalRandom.current().nextLong(baseMillis / 2 + 1);
        try {
            Thread.sleep(baseMillis + jitterMillis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    record EmbeddingResponse(List<Data> data, String model, Usage usage) {

        record Data(List<Double> embedding) {}

        record Usage(@JsonProperty("prompt_tokens") int promptTokens,
                     @JsonProperty("total_tokens") int totalTokens) {}
    }
}
