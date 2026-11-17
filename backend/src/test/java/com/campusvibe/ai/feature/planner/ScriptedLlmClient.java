package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmClient;
import com.campusvibe.ai.client.LlmRequest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * The planner's model in tests: no call ever leaves the JVM. A test sets what
 * the next reply streams, in fragments, or what it throws, and reads back the
 * request the planner built.
 *
 * <p>Tool rounds (ADR-023) are queued with {@link #callTools}: each round
 * that allows tools takes the next queued set of calls instead of answering.
 */
public class ScriptedLlmClient implements LlmClient {

    @TestConfiguration
    public static class Config {
        @Bean
        @Primary
        public ScriptedLlmClient scriptedLlmClient() {
            return new ScriptedLlmClient();
        }
    }

    private volatile boolean configured = true;
    private volatile Function<LlmRequest, List<String>> script = request -> List.of(
            "{\"intro\":\"Nothing fits.\",\"kind\":\"none\",\"picks\":[]}");
    private volatile RuntimeException failure;
    private volatile LlmRequest lastRequest;
    private final Deque<List<LlmRequest.ToolCall>> toolRounds = new ArrayDeque<>();
    private final List<LlmRequest> requests = new ArrayList<>();

    public synchronized void reset() {
        configured = true;
        failure = null;
        lastRequest = null;
        toolRounds.clear();
        requests.clear();
        script = request -> List.of("{\"intro\":\"Nothing fits.\",\"kind\":\"none\",\"picks\":[]}");
    }

    public void setConfigured(boolean configured) {
        this.configured = configured;
    }

    /** The fragments the next replies stream, chosen from the request if need be. */
    public void answerWith(Function<LlmRequest, List<String>> script) {
        this.script = script;
        this.failure = null;
    }

    /** The next round that allows tools calls these instead of answering. */
    public synchronized void callTools(LlmRequest.ToolCall... calls) {
        toolRounds.add(List.of(calls));
    }

    /** Every request of the last replies, in order: one per round. */
    public synchronized List<LlmRequest> requests() {
        return List.copyOf(requests);
    }

    public void failWith(RuntimeException failure) {
        this.failure = failure;
    }

    public LlmRequest lastRequest() {
        return lastRequest;
    }

    @Override
    public boolean isConfigured() {
        return configured;
    }

    @Override
    public LlmClient.Turn streamTurn(LlmRequest request, Consumer<String> onText) {
        List<LlmRequest.ToolCall> calls;
        synchronized (this) {
            lastRequest = request;
            requests.add(request);
            calls = request.toolsAllowed() ? toolRounds.poll() : null;
        }
        if (calls != null) {
            return new LlmClient.Turn("", calls);
        }
        if (failure != null) {
            throw failure;
        }
        StringBuilder text = new StringBuilder();
        for (String fragment : script.apply(request)) {
            text.append(fragment);
            onText.accept(fragment);
        }
        return new LlmClient.Turn(text.toString(), List.of());
    }
}
