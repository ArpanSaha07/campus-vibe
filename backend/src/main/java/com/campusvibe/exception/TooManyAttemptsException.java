package com.campusvibe.exception;

/**
 * Raised when an account is locked after too many failed password attempts.
 * Mapped to 429 with a Retry-After header by DefaultExceptionHandler.
 */
public class TooManyAttemptsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyAttemptsException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
