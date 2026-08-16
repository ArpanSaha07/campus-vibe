package com.campusvibe.security.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.IOException;

/**
 * The 429 written by rate-limit filters.
 *
 * <p>Shared so every refusal has the same shape as the rest of the API's errors
 * ({@code ApiError}: path, message, statusCode) — a filter runs before
 * {@code @ControllerAdvice}, so it has to produce that shape itself rather than
 * inheriting it.
 */
final class RateLimitResponses {

    private RateLimitResponses() {}

    static void tooManyRequests(HttpServletRequest request,
                                HttpServletResponse response,
                                long retryAfterSeconds,
                                String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("""
                {"path":"%s","message":"%s","statusCode":429}"""
                .formatted(request.getRequestURI(), message.formatted(retryAfterSeconds)));
    }
}
