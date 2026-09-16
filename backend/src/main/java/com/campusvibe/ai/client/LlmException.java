package com.campusvibe.ai.client;

/**
 * A generative call that did not produce a usable answer.
 *
 * <p>The message is for logs and never reaches a client, and it never carries
 * the provider's response body, which can echo the prompt.
 */
public class LlmException extends RuntimeException {

    public enum Reason {
        /** No key, or the key was rejected. */
        NOT_CONFIGURED,
        /** Network failure, timeout, or a provider 5xx or 429 after retries. */
        UNAVAILABLE,
        /** The output stopped at the token cap, so it is not complete JSON. */
        TRUNCATED,
        /** The provider refused, or filtered, the output. */
        REFUSED,
        /** Anything else: an unexpected status or a malformed stream. */
        FAILED
    }

    private final Reason reason;

    public LlmException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public LlmException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
