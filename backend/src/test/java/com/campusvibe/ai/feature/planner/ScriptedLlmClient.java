package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmClient;
import com.campusvibe.ai.client.LlmRequest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * The planner's model in tests: no call ever leaves the JVM. A test sets what
 * the next reply streams, in fragments, or what it throws, and reads back the
 * request the planner built.
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

    public void reset() {
        configured = true;
        failure = null;
        lastRequest = null;
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
    public String streamStructured(LlmRequest request, Consumer<String> onText) {
        lastRequest = request;
        if (failure != null) {
            throw failure;
        }
        StringBuilder text = new StringBuilder();
        for (String fragment : script.apply(request)) {
            text.append(fragment);
            onText.accept(fragment);
        }
        return text.toString();
    }
}
