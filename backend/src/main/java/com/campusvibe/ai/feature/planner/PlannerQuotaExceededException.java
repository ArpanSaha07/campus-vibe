package com.campusvibe.ai.feature.planner;

import com.campusvibe.exception.TooManyAttemptsException;

/**
 * The day's planner messages are used up. A 429 with Retry-After, through the
 * existing {@link TooManyAttemptsException} handler, so the page sees the
 * status before any stream starts.
 */
public class PlannerQuotaExceededException extends TooManyAttemptsException {

    public PlannerQuotaExceededException(long secondsUntilReset) {
        super("You've used all of today's planner messages. They reset at midnight.", secondsUntilReset);
    }
}
