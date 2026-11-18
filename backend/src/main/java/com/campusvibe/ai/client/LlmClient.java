package com.campusvibe.ai.client;

import java.util.List;
import java.util.function.Consumer;

/**
 * A generative model, whichever provider serves it.
 *
 * <p>Feature services depend on this, never on OpenAI: nothing outside
 * {@code ai.client} knows the provider, the key or the wire format (the
 * llm-integration skill).
 */
public interface LlmClient {

    /**
     * What one round produced: either the answer text, or the tools the model
     * called instead (ADR-023). {@code toolCalls} is empty for an answer.
     */
    record Turn(String text, List<LlmRequest.ToolCall> toolCalls) {

        public Turn {
            text = text == null ? "" : text;
            toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
        }

        public boolean calledTools() {
            return !toolCalls.isEmpty();
        }
    }

    /** False when no provider key is set; a caller must answer 503 rather than call. */
    boolean isConfigured();

    /**
     * Streams one round whose answer is constrained to
     * {@link LlmRequest#jsonSchema()}, or which calls one of
     * {@link LlmRequest#tools()} when {@link LlmRequest#toolsAllowed()}.
     *
     * <p>Each fragment of answer text goes to {@code onText} as it arrives, on
     * the calling thread. An exception thrown by {@code onText} stops the
     * stream and propagates unchanged, which is how a caller whose client has
     * gone away cancels the provider call. Retries happen only before the first
     * fragment, so {@code onText} never sees text twice.
     *
     * @throws LlmException when the provider call fails, is cut off, or refuses
     */
    Turn streamTurn(LlmRequest request, Consumer<String> onText);

    /** One round without tools: the whole answer text. */
    default String streamStructured(LlmRequest request, Consumer<String> onText) {
        return streamTurn(request.withTools(List.of(), false), onText).text();
    }
}
