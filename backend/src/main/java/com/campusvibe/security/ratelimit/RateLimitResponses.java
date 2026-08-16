package com.campusvibe.security.ratelimit;

import com.campusvibe.exception.TooManyAttemptsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * The 429 written by rate-limit filters.
 *
 * <p>A filter runs before {@code DispatcherServlet}, so {@code @ControllerAdvice}
 * never sees what it throws and the refusal has to be produced here. This used
 * to mean building the JSON by hand with {@code String.formatted}, which was
 * wrong twice over: it escaped nothing, so any value interpolated into it could
 * close the string and rewrite the document; and it emitted three of
 * {@code ApiError}'s four fields, so a throttled caller got a body subtly unlike
 * every other error the API returns.
 *
 * <p>Handing the exception to {@code handlerExceptionResolver} instead runs the
 * refusal back through the ordinary {@code @ControllerAdvice} path — the same
 * handler, the same serializer, the same shape — so there is no second copy of
 * the error format to keep in step, and no hand-rolled escaping to get wrong.
 *
 * <p>{@code @Lazy} because this bean is pulled in by security filters, which are
 * built early; resolving the MVC infrastructure at that point would drag it into
 * the security chain's construction.
 */
@Component
class RateLimitResponses {

    private final HandlerExceptionResolver resolver;

    RateLimitResponses(@Lazy @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
        this.resolver = resolver;
    }

    /**
     * @param message a format string owned by the calling filter, whose single
     *                {@code %d} is the retry delay. Never caller-supplied text.
     */
    void tooManyRequests(HttpServletRequest request,
                         HttpServletResponse response,
                         long retryAfterSeconds,
                         String message) {
        TooManyAttemptsException refusal =
                new TooManyAttemptsException(message.formatted(retryAfterSeconds), retryAfterSeconds);

        if (resolver.resolveException(request, response, null, refusal) == null) {
            // Only reachable if the advice that maps this exception is ever
            // removed. Answer 429 regardless — silently falling through to 200
            // would tell the caller their request succeeded when it was refused.
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        }
    }
}
