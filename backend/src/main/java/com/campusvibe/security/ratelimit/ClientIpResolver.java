package com.campusvibe.security.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Works out which IP a request should be billed to.
 *
 * <p>Shared by every rate limiter, because getting this wrong breaks all of them
 * in the same two ways. Behind a load balancer the remote address is the
 * balancer, so every caller in the world shares one bucket. On a directly
 * exposed app, trusting {@code X-Forwarded-For} lets a caller forge a fresh IP
 * per request and bypass the limit entirely.
 *
 * <p>Neither default is safe everywhere, so it is configuration — and the safe
 * one is the default. Production behind an ALB must set
 * {@code AUTH_RATE_LIMIT_TRUST_XFF=true}.
 */
@Component
public class ClientIpResolver {

    private final boolean trustForwardedHeader;

    public ClientIpResolver(RateLimitProperties properties) {
        this.trustForwardedHeader = properties.trustForwardedHeader();
    }

    public String resolve(HttpServletRequest request) {
        if (trustForwardedHeader) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                // Left-most entry is the original client; the rest are proxies.
                return forwarded.split(",")[0].trim();
            }
        }
        String remote = request.getRemoteAddr();
        return remote != null ? remote : "unknown";
    }
}
