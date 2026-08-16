package com.campusvibe.security.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
    private final ClientIpResolver clientIp;

    public AuthRateLimitFilter(AuthRateLimiter rateLimiter, ClientIpResolver clientIp) {
        this.rateLimiter = rateLimiter;
        this.clientIp = clientIp;
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

        if (rateLimiter.tryConsumeForIp(clientIp.resolve(request))) {
            filterChain.doFilter(request, response);
            return;
        }

        RateLimitResponses.tooManyRequests(request, response,
                rateLimiter.retryAfterSeconds(),
                "Too many attempts. Try again in %d seconds.");
    }
}
