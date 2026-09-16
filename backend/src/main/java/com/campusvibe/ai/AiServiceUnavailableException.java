package com.campusvibe.ai;

/**
 * A generative feature cannot run at all: no provider key is configured.
 * Mapped to 503 by {@code DefaultExceptionHandler}, before any stream starts.
 *
 * <p>Not used for a provider that fails part way through a reply; that is an
 * {@code error} frame on a stream already under way.
 */
public class AiServiceUnavailableException extends RuntimeException {

    public AiServiceUnavailableException(String message) {
        super(message);
    }
}
