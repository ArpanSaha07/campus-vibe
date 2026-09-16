package com.campusvibe.ai.client;

import java.util.function.Consumer;

/**
 * A generative model, whichever provider serves it.
 *
 * <p>Feature services depend on this, never on OpenAI: nothing outside
 * {@code ai.client} knows the provider, the key or the wire format (the
 * llm-integration skill). One method for now, because the planner is the only
 * generative feature; add another when a feature needs a different shape, not
 * before.
 */
public interface LlmClient {

    /** False when no provider key is set; a caller must answer 503 rather than call. */
    boolean isConfigured();

    /**
     * Streams one completion whose output is constrained to
     * {@link LlmRequest#jsonSchema()}.
     *
     * <p>Each fragment of the output text goes to {@code onText} as it arrives,
     * on the calling thread. An exception thrown by {@code onText} stops the
     * stream and propagates unchanged, which is how a caller whose client has
     * gone away cancels the provider call. Retries happen only before the first
     * fragment, so {@code onText} never sees text twice.
     *
     * @return the whole output text
     * @throws LlmException when the provider call fails, is cut off, or refuses
     */
    String streamStructured(LlmRequest request, Consumer<String> onText);
}
