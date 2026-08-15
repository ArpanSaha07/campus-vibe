package com.campusvibe.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Application-level mail settings, distinct from Spring's {@code spring.mail.*}
 * transport settings.
 *
 * @param from             envelope sender for outgoing mail
 * @param appBaseUrl       the address links in emails point at. This is the
 *                         **frontend**, not the API: a reset link has to open a
 *                         page a human can type a password into. Getting this
 *                         wrong sends every user a dead link, and it cannot be
 *                         derived from the request, because the request comes
 *                         from the frontend server, not the browser.
 * @param resetTokenTtl    how long a password-reset link stays usable
 * @param verifyTokenTtl   how long an email-verification link stays usable
 */
@ConfigurationProperties(prefix = "campusvibe.mail")
public record AppMailProperties(
        String from,
        String appBaseUrl,
        Duration resetTokenTtl,
        Duration verifyTokenTtl
) {
    public AppMailProperties {
        if (from == null || from.isBlank()) from = "no-reply@campusvibe.local";
        if (appBaseUrl == null || appBaseUrl.isBlank()) appBaseUrl = "http://localhost:3000";
        // Trailing slash would produce '...//?auth=' in every link.
        while (appBaseUrl.endsWith("/")) appBaseUrl = appBaseUrl.substring(0, appBaseUrl.length() - 1);
        if (resetTokenTtl == null) resetTokenTtl = Duration.ofHours(1);
        if (verifyTokenTtl == null) verifyTokenTtl = Duration.ofHours(24);
    }
}
