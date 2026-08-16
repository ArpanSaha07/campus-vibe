package com.campusvibe.security.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Limits for the public search endpoints.
 *
 * <p>Separate from the auth limits on purpose. The two exist for different
 * reasons — auth bounds credential guessing, search bounds **OpenAI spend**
 * ([BUG-005]) — so they need different numbers, and neither should be able to
 * consume the other's allowance. Search is deliberately public, which is exactly
 * why the compensating control is required rather than optional.
 *
 * <p>The budget is more generous than the auth one: a person typing in the
 * search box legitimately produces a burst, and the debounce is client-side and
 * trivially bypassed.
 */
@ConfigurationProperties(prefix = "campusvibe.search.rate-limit")
public record SearchRateLimitProperties(
        boolean enabled,
        int ipRequestsPerWindow,
        Duration window
) {
    public SearchRateLimitProperties {
        if (ipRequestsPerWindow <= 0) ipRequestsPerWindow = 30;
        if (window == null) window = Duration.ofMinutes(1);
    }
}
