package com.campusvibe.security.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A per-IP request budget over a rolling window, held in memory.
 *
 * <p>Extracted so the auth limiter and the search limiter share one
 * implementation while keeping separate budgets — they exist for different
 * reasons (credential guessing versus OpenAI spend) and must not consume each
 * other's allowance.
 *
 * <p>Caffeine rather than a plain map because entries must expire on their own:
 * a map keyed by IP with no eviction is an unbounded allocation an attacker
 * controls.
 *
 * <p>In memory means per instance and reset on restart. Accepted while there is
 * one backend; a second instance doubles every effective limit, and that is the
 * trigger to move this to Redis.
 */
public class IpBudget {

    private final Cache<String, AtomicInteger> hits;
    private final int limit;
    private final Duration window;

    public IpBudget(int limit, Duration window) {
        this.limit = limit;
        this.window = window;
        this.hits = Caffeine.newBuilder()
                .expireAfterWrite(window)
                .maximumSize(100_000)
                .build();
    }

    /** @return true if this request is within budget. */
    public boolean tryConsume(String ip) {
        return hits.get(ip, k -> new AtomicInteger()).incrementAndGet() <= limit;
    }

    /** Seconds a refused caller should wait, for the Retry-After header. */
    public long retryAfterSeconds() {
        return Math.max(1, window.toSeconds());
    }

    /** Test seam: forget every counter. Never called by application code. */
    public void reset() {
        hits.invalidateAll();
    }
}
