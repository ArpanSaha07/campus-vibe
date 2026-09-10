package com.campusvibe.club;

import com.campusvibe.common.WebLinks;
import com.campusvibe.exception.RequestValidationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.util.regex.Pattern;

/**
 * A club's four public contact values, and the one place they are checked.
 *
 * <p>They are stored as a JSON string in a single column rather than as columns
 * — {@code Club.socialLinks} — so this record exists to give that string a
 * shape long enough to validate it. Two writers need that: {@code ClubService}
 * on {@code PUT /clubs/&#123;id&#125;} and {@code ClubCreationRequestService},
 * where the same four values arrive on a proposal.
 *
 * <p><strong>Why this is not optional.</strong> The three links reach an
 * {@code href} on the public club page. Until this existed, whatever string a
 * client sent was stored and rendered with nothing checking the scheme, so
 * {@code javascript:alert(1)} in the website field was a script on the club's
 * page waiting for a click. The profile side has refused that since it was
 * built; clubs never did (BUG-048).
 *
 * <p><strong>The email is not a link, and is deliberately not normalised like
 * one.</strong> {@code hello@yourclub.ca} has no scheme, so
 * {@link WebLinks#normalise} would read it as a bare host and return
 * {@code https://hello@yourclub.ca} — a URI that parses, carries a host, and is
 * nonsense. It is checked as an address instead.
 *
 * <p>What comes back out of {@link #normalise} is <em>our</em> JSON, built from
 * this record, never the client's string handed back. That is the quiet benefit
 * of validating a value we could have stored opaquely: the column holds four
 * known keys in a known order, or NULL.
 */
public record ClubSocialLinks(String email, String website, String facebook, String instagram) {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            // A club editor that learns a fifth link should not break every
            // older row, and an unknown key is not worth a 400 to a user who
            // cannot see the payload.
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .build();

    /**
     * The same shape the browser checks with, on purpose: a stricter rule here
     * refuses an address the form said was fine, which reads as a broken form.
     * Neither is an assertion that mail arrives — that is what the official
     * email round trip is for (ADR-006), and this address is not that one.
     */
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    /** Long enough for four real values, short enough not to be a payload. */
    private static final int MAX_JSON_LENGTH = 2000;

    private static final int MAX_VALUE_LENGTH = 500;

    /**
     * Checks a client's JSON string and returns ours, or null.
     *
     * @param rawJson the JSON object as submitted; null or blank means not set
     * @return a JSON object carrying all four keys, or null when every value is
     *         empty — so clearing the last link leaves NULL rather than a husk
     *         of empty strings
     * @throws RequestValidationException (→ 400) if it is not a JSON object, is
     *         too long, or carries a value that is not a http(s) link or, for
     *         the email, an address
     */
    public static String normalise(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return null;
        }
        if (rawJson.length() > MAX_JSON_LENGTH) {
            throw new RequestValidationException("Contact links are too long");
        }

        ClubSocialLinks parsed;
        try {
            parsed = MAPPER.readValue(rawJson, ClubSocialLinks.class);
        } catch (JsonProcessingException e) {
            // Includes a JSON array or a bare number: readValue refuses to bind
            // either to a record. The message says nothing about what was sent.
            throw new RequestValidationException("Contact links are not in a form we can read");
        }
        if (parsed == null) {
            // The literal `null`, which is valid JSON and binds to nothing.
            return null;
        }

        ClubSocialLinks clean = new ClubSocialLinks(
                normaliseEmail(parsed.email()),
                blankIfNull(WebLinks.normalise(bounded(parsed.website(), "Website"), "Website")),
                blankIfNull(WebLinks.normalise(bounded(parsed.facebook(), "Facebook"), "Facebook")),
                // A handle, not a link: the form asks for `yourclub` and this
                // builds the URL. It still accepts a pasted instagram.com URL.
                blankIfNull(WebLinks.normaliseInstagram(
                        bounded(parsed.instagram(), "Instagram"), "Instagram")));

        if (clean.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(clean);
        } catch (JsonProcessingException e) {
            // Four strings cannot fail to serialise. Not swallowed, because a
            // silent null here would clear a club's links.
            throw new IllegalStateException("Could not serialise club social links", e);
        }
    }

    private boolean isEmpty() {
        return email.isEmpty() && website.isEmpty() && facebook.isEmpty() && instagram.isEmpty();
    }

    private static String normaliseEmail(String raw) {
        String trimmed = bounded(raw, "Contact email");
        if (trimmed == null || trimmed.isEmpty()) {
            return "";
        }
        if (!EMAIL.matcher(trimmed).matches()) {
            throw new RequestValidationException("Contact email must be a valid email address");
        }
        return trimmed;
    }

    private static String bounded(String raw, String field) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.length() > MAX_VALUE_LENGTH) {
            throw new RequestValidationException("%s is too long".formatted(field));
        }
        return trimmed;
    }

    /**
     * All four keys are always written, empty rather than absent. The frontend
     * type says every field is a string, and a missing key would make that a
     * lie at runtime for anything reading a club from the API.
     */
    private static String blankIfNull(String value) {
        return value == null ? "" : value;
    }
}
