package com.campusvibe.ai.client;

import com.campusvibe.ai.config.OpenAiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * {@link LlmClient} on OpenAI Chat Completions, streamed, with a strict
 * {@code json_schema} response format.
 *
 * <p>Uses the shared {@code openAiRestClient}, so the key is still read in one
 * place ({@code AiClientConfig}). Logs operational metadata only: never the
 * messages, the output, or a provider response body.
 *
 * <p><b>Retries only before the first fragment.</b> A 429, a 5xx or a network
 * failure before any text arrived is retried with backoff; once text has gone
 * to the caller it may already be on a user's screen, and a second attempt
 * would write a different answer after it.
 */
@Component
public class OpenAiLlmClient implements LlmClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiLlmClient.class);
    private static final Duration INITIAL_BACKOFF = Duration.ofMillis(200);
    private static final int RATE_LIMITED = 429;
    private static final int UNAUTHORIZED = 401;

    // Low: the planner recommends from a fixed list, and a creative reply is
    // one that invents a reason the event does not support.
    private static final double TEMPERATURE = 0.3;

    private final RestClient restClient;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper;

    // Closes a stream that outlives chatTimeout. One daemon thread: it only
    // ever runs a close() call.
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "openai-stream-watchdog");
        thread.setDaemon(true);
        return thread;
    });

    public OpenAiLlmClient(RestClient openAiRestClient, OpenAiProperties properties, ObjectMapper objectMapper) {
        this.restClient = openAiRestClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @PreDestroy
    void shutdown() {
        watchdog.shutdownNow();
    }

    @Override
    public boolean isConfigured() {
        return properties.isConfigured();
    }

    @Override
    public String streamStructured(LlmRequest request, Consumer<String> onText) {
        if (!isConfigured()) {
            throw new LlmException(LlmException.Reason.NOT_CONFIGURED, "OPENAI_API_KEY is not set");
        }

        Map<String, Object> body = requestBody(request);
        int maxAttempts = Math.max(0, properties.maxRetries()) + 1;
        AtomicBoolean delivered = new AtomicBoolean(false);
        Consumer<String> tracking = fragment -> {
            delivered.set(true);
            onText.accept(fragment);
        };

        for (int attempt = 1; ; attempt++) {
            long startedAt = System.nanoTime();
            try {
                OpenAiChatStream.Result result = restClient.post()
                        .uri("/v1/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .body(body)
                        .exchange((req, response) -> {
                            int status = response.getStatusCode().value();
                            if (status != 200) {
                                // The body is not read: it can echo the request.
                                throw new ProviderStatusException(status);
                            }
                            return readWithDeadline(response.getBody(), tracking);
                        });
                logUsage(request.feature(), startedAt, result.totalTokens());
                return result.text();

            } catch (ProviderStatusException e) {
                boolean transientStatus = e.status == RATE_LIMITED || e.status >= 500;
                if (transientStatus && !delivered.get() && attempt < maxAttempts) {
                    backOff(attempt);
                    continue;
                }
                if (e.status == UNAUTHORIZED) {
                    log.error("OpenAI rejected the API key (HTTP 401) for feature [{}]. Check OPENAI_API_KEY.",
                            request.feature());
                    throw new LlmException(LlmException.Reason.NOT_CONFIGURED, "The provider rejected the key");
                }
                log.warn("OpenAI chat request for feature [{}] failed with HTTP {}", request.feature(), e.status);
                throw new LlmException(transientStatus ? LlmException.Reason.UNAVAILABLE : LlmException.Reason.FAILED,
                        "Provider answered HTTP " + e.status);

            } catch (ResourceAccessException e) {
                if (!delivered.get() && attempt < maxAttempts) {
                    backOff(attempt);
                    continue;
                }
                log.warn("OpenAI chat request for feature [{}] failed after {} attempt(s) ({})",
                        request.feature(), attempt, e.getClass().getSimpleName());
                throw new LlmException(LlmException.Reason.UNAVAILABLE, "Provider unreachable", e);
            }
        }
    }

    /**
     * Reads the stream, closing it from the watchdog if it runs past
     * {@code chatTimeout}. A read blocked on a stalled connection then fails
     * with an IOException, which becomes UNAVAILABLE.
     */
    private OpenAiChatStream.Result readWithDeadline(InputStream stream, Consumer<String> onText) throws IOException {
        AtomicBoolean timedOut = new AtomicBoolean(false);
        ScheduledFuture<?> deadline = watchdog.schedule(() -> {
            timedOut.set(true);
            try {
                stream.close();
            } catch (IOException ignored) {
                // Closing is the whole point; a failure to close changes nothing.
            }
        }, properties.chatTimeout().toMillis(), TimeUnit.MILLISECONDS);
        try {
            return OpenAiChatStream.read(stream, objectMapper, onText);
        } catch (IOException e) {
            throw new LlmException(LlmException.Reason.UNAVAILABLE,
                    timedOut.get() ? "The stream ran past chatTimeout" : "The stream broke off", e);
        } finally {
            deadline.cancel(false);
        }
    }

    private Map<String, Object> requestBody(LlmRequest request) {
        List<Map<String, String>> messages = request.messages().stream()
                .map(message -> Map.of(
                        "role", message.role().name().toLowerCase(Locale.ROOT),
                        "content", message.content()))
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", properties.chatModel());
        body.put("messages", messages);
        body.put("stream", true);
        body.put("stream_options", Map.of("include_usage", true));
        body.put("max_completion_tokens", properties.maxOutputTokens());
        body.put("temperature", TEMPERATURE);
        body.put("response_format", Map.of(
                "type", "json_schema",
                "json_schema", Map.of(
                        "name", request.schemaName(),
                        "strict", true,
                        "schema", request.jsonSchema())));
        return body;
    }

    private void logUsage(String feature, long startedAt, int totalTokens) {
        long latencyMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        log.info("ai.usage feature={} provider=openai model={} latencyMs={} totalTokens={}",
                feature, properties.chatModel(), latencyMs, totalTokens);
    }

    private void backOff(int attempt) {
        long baseMillis = INITIAL_BACKOFF.toMillis() * (1L << (attempt - 1));
        long jitterMillis = ThreadLocalRandom.current().nextLong(baseMillis / 2 + 1);
        try {
            Thread.sleep(baseMillis + jitterMillis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    /** A non-200 answer, carried out of the exchange callback without its body. */
    private static final class ProviderStatusException extends RuntimeException {
        private final int status;

        ProviderStatusException(int status) {
            super("HTTP " + status, null, false, false);
            this.status = status;
        }
    }
}
