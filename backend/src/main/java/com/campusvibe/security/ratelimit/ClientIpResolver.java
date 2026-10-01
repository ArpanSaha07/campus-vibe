package com.campusvibe.security.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Works out which IP a request should be billed to.
 *
 * <p>Shared by every rate limiter, because getting this wrong breaks all of them
 * in the same two ways. Behind a proxy the remote address is the proxy, so every
 * caller in the world shares one bucket. On a directly exposed app, trusting
 * {@code X-Forwarded-For} lets a caller forge a fresh IP per request and bypass
 * the limit entirely.
 *
 * <p>Neither default is safe everywhere, so it is configuration — and the safe
 * one is the default. Production behind a proxy must set
 * {@code AUTH_RATE_LIMIT_TRUST_XFF=true}.
 *
 * <p>The header is read from the right. Each trusted proxy appends the address
 * it received from, so the client sits {@code trustedProxyHops} entries from the
 * end: CloudFront (or an ALB) appends the viewer, then Elastic Beanstalk's nginx
 * appends CloudFront. Every entry further left came from the caller, who can
 * write anything there (ADR-017).
 */
@Component
public class ClientIpResolver {

    private final boolean trustForwardedHeader;
    private final int trustedProxyHops;

    public ClientIpResolver(RateLimitProperties properties) {
        this.trustForwardedHeader = properties.trustForwardedHeader();
        this.trustedProxyHops = properties.trustedProxyHops();
    }

    public String resolve(HttpServletRequest request) {
        if (trustForwardedHeader) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] entries = forwarded.split(",");
                // Fewer entries than hops means a proxy did not append; the
                // left-most is then the nearest thing to the client there is.
                int client = Math.max(0, entries.length - trustedProxyHops);
                String ip = entries[client].trim();
                if (!ip.isEmpty()) {
                    return ip;
                }
            }
        }
        String remote = request.getRemoteAddr();
        return remote != null ? remote : "unknown";
    }
}
