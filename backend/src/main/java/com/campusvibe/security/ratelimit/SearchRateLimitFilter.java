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
 * Bounds the public search endpoints ([BUG-005]).
 *
 * <p>Every search request can cost an OpenAI embedding call, and search is
 * deliberately unauthenticated so that visitors can browse before signing up.
 * The only throttle before this was a 300 ms debounce in the browser, which
 * anyone calling the API directly simply skips.
 *
 * <p>A filter, so a refused request never reaches the service and therefore
 * never reaches the provider — a limiter applied after the embedding call would
 * bound the response rate while leaving the bill unchanged.
 *
 * <p>This is one of three controls for that bug. The other two are the query
 * length cap on the controllers and the query-embedding cache in
 * {@code QueryEmbeddingCache}; a rate limit alone still lets a slow, steady
 * caller spend indefinitely.
 */
@Component
public class SearchRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/v1/events/search",
            "/api/v1/clubs/search"
    );

    private final SearchRateLimitProperties properties;
    private final ClientIpResolver clientIp;
    private final RateLimitResponses responses;
    private final IpBudget budget;

    public SearchRateLimitFilter(SearchRateLimitProperties properties,
                                 ClientIpResolver clientIp,
                                 RateLimitResponses responses) {
        this.properties = properties;
        this.clientIp = clientIp;
        this.responses = responses;
        this.budget = new IpBudget(properties.ipRequestsPerWindow(), properties.window());
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

        if (!properties.enabled() || budget.tryConsume(clientIp.resolve(request))) {
            filterChain.doFilter(request, response);
            return;
        }

        responses.tooManyRequests(request, response, budget.retryAfterSeconds(),
                "Too many searches. Try again in %d seconds.");
    }

    /** Test seam. */
    public void reset() {
        budget.reset();
    }
}
