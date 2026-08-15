package com.campusvibe.security.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Limits for the unauthenticated auth endpoints.
 *
 * <p>Externalised like everything else so the same artifact runs unchanged in
 * dev and production; only the source of the values differs.
 *
 * @param enabled            master switch. Off in the test profile, where a
 *                           suite that hammers /login would otherwise lock
 *                           itself out and fail for the wrong reason.
 * @param ipRequestsPerWindow requests one client IP may make to the auth
 *                           endpoints in a window
 * @param window             the window those requests are counted over
 * @param maxFailedLogins    consecutive failed password attempts against one
 *                           address before it is locked
 * @param lockoutDuration    how long that lock lasts. Deliberately finite:
 *                           a permanent lock hands an attacker a way to deny a
 *                           known user their account by failing on purpose.
 * @param trustForwardedHeader whether to read the client IP from
 *                           X-Forwarded-For. **Default false.** True only when
 *                           the app genuinely sits behind a proxy that sets it
 *                           (an ALB); trusting it on a directly exposed app
 *                           lets any caller forge a fresh IP per request and
 *                           bypass the limit entirely.
 */
@ConfigurationProperties(prefix = "campusvibe.auth.rate-limit")
public record RateLimitProperties(
        boolean enabled,
        int ipRequestsPerWindow,
        Duration window,
        int maxFailedLogins,
        Duration lockoutDuration,
        boolean trustForwardedHeader
) {
    public RateLimitProperties {
        if (ipRequestsPerWindow <= 0) ipRequestsPerWindow = 20;
        if (window == null) window = Duration.ofMinutes(1);
        if (maxFailedLogins <= 0) maxFailedLogins = 5;
        if (lockoutDuration == null) lockoutDuration = Duration.ofMinutes(15);
    }
}
