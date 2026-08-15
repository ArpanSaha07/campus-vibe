package com.campusvibe.security.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Two counters, both in memory, both bounded and self-expiring.
 *
 * <p><b>Per IP</b> — a request budget across all the auth endpoints, which is
 * what actually bounds online password guessing, signup spam and enumeration
 * through {@code /email-status}.
 *
 * <p><b>Per account</b> — consecutive failed password attempts against one
 * address, which catches a distributed attempt that stays under the per-IP
 * budget from any single source.
 *
 * <p><b>Why in memory.</b> One backend instance today, so a shared store would
 * be infrastructure bought for nothing. Two consequences are accepted and
 * documented rather than solved: counters reset when the process restarts, and
 * with two instances each would enforce its own budget, so the effective limit
 * doubles. Both stop being acceptable at the moment a second instance exists —
 * that is the trigger to move this to Redis, and the interface here is
 * deliberately small enough to swap.
 *
 * <p>Caffeine rather than a plain map because entries must expire on their own;
 * a map keyed by IP or email with no eviction is an unbounded allocation an
 * attacker controls.
 */
@Component
public class AuthRateLimiter {

    private final RateLimitProperties properties;
    private final Cache<String, AtomicInteger> ipHits;
    private final Cache<String, AtomicInteger> failedLogins;

    public AuthRateLimiter(RateLimitProperties properties) {
        this.properties = properties;
        this.ipHits = Caffeine.newBuilder()
                .expireAfterWrite(properties.window())
                .maximumSize(100_000)
                .build();
        this.failedLogins = Caffeine.newBuilder()
                // Refreshed on each failure, so the lock window runs from the
                // most recent attempt rather than the first.
                .expireAfterWrite(properties.lockoutDuration())
                .maximumSize(100_000)
                .build();
    }

    /** @return true if this request is within the per-IP budget. */
    public boolean tryConsumeForIp(String ip) {
        if (!properties.enabled()) return true;
        AtomicInteger hits = ipHits.get(ip, k -> new AtomicInteger());
        return hits.incrementAndGet() <= properties.ipRequestsPerWindow();
    }

    /** @return true if this address is currently locked out. */
    public boolean isAccountLocked(String email) {
        if (!properties.enabled() || email == null) return false;
        AtomicInteger failures = failedLogins.getIfPresent(email);
        return failures != null && failures.get() >= properties.maxFailedLogins();
    }

    /**
     * Records a failed password attempt.
     *
     * <p>Called for an unknown address as well as a wrong password. Counting
     * only real accounts would make the two distinguishable by whether the
     * response ever changes to a 429 — reintroducing, through the rate limiter,
     * exactly the enumeration the identical 401 exists to prevent.
     */
    public void recordFailedLogin(String email) {
        if (!properties.enabled() || email == null) return;
        // Re-put so expireAfterWrite restarts from this attempt.
        AtomicInteger failures = failedLogins.get(email, k -> new AtomicInteger());
        failures.incrementAndGet();
        failedLogins.put(email, failures);
    }

    /** Clears the failure count for an address after a successful sign-in. */
    public void recordSuccessfulLogin(String email) {
        if (email != null) failedLogins.invalidate(email);
    }

    /** Seconds a caller should wait, for the Retry-After header. */
    public long retryAfterSeconds() {
        return Math.max(1, properties.window().toSeconds());
    }

    public long lockoutSeconds() {
        return Math.max(1, properties.lockoutDuration().toSeconds());
    }

    /** Test seam: forget everything. Never called by application code. */
    public void reset() {
        ipHits.invalidateAll();
        failedLogins.invalidateAll();
    }
}
