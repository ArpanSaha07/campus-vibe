package com.campusvibe.security.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Applies the per-IP budget to the unauthenticated auth endpoints.
 *
 * <p>A filter rather than an interceptor or AOP advice so it runs <em>before</em>
 * anything expensive: bcrypt is deliberately slow, and a limiter that only fires
 * after the hash has been computed does not protect the CPU it was added to
 * protect.
 *
 * <p>Per-account lockout is enforced in {@code AuthenticationService.login}
 * instead, because only that layer has parsed the request body and so knows
 * which address is being attempted.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    /** Everything reachable without a token, and so everything worth abusing. */
    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/google",
            "/api/v1/auth/email-status"
    );

    private final AuthRateLimiter rateLimiter;
    private final RateLimitProperties properties;

    public AuthRateLimitFilter(AuthRateLimiter rateLimiter, RateLimitProperties properties) {
        this.rateLimiter = rateLimiter;
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        if (rateLimiter.tryConsumeForIp(clientIp(request))) {
            filterChain.doFilter(request, response);
            return;
        }

        long retryAfter = rateLimiter.retryAfterSeconds();
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("""
                {"path":"%s","message":"Too many attempts. Try again in %d seconds.",\
                "statusCode":429}""".formatted(request.getRequestURI(), retryAfter));
    }

    /**
     * X-Forwarded-For is read only when explicitly trusted. Behind an ALB the
     * remote address is the load balancer and every caller would share one
     * bucket; on a directly exposed app, trusting the header lets a caller
     * forge a new IP per request and bypass the limit completely. Neither
     * default is safe everywhere, so it is configuration, and the safe one is
     * the default.
     */
    private String clientIp(HttpServletRequest request) {
        if (properties.trustForwardedHeader()) {
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
