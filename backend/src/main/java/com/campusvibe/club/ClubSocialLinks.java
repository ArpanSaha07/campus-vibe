package com.campusvibe.club;

import com.campusvibe.common.WebLinks;
import com.campusvibe.exception.RequestValidationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * A club's six public contact values, and the one place they are checked.
 *
 * <p>They are stored as a JSON string in a single column rather than as columns
 * — {@code Club.socialLinks} — so this record exists to give that string a
 * shape long enough to validate it. Two writers need that: {@code ClubService}
 * on {@code PUT /clubs/&#123;id&#125;} and {@code ClubCreationRequestService},
 * where the same six values arrive on a proposal.
 *
 * <p><strong>Why this is not optional.</strong> The five links reach an
 * {@code href} on the public club page. Until this existed, whatever string a
 * client sent was stored and rendered with nothing checking the scheme, so
 * {@code javascript:alert(1)} in the website field was a script on the club's
 * page waiting for a click. The profile side has refused that since it was
 * built; clubs never did (BUG-048).
 *
 * <p><strong>Adding a key is a code change here, not only in the form.</strong>
 * Jackson runs with {@code FAIL_ON_UNKNOWN_PROPERTIES} off, so a key this record
 * does not name is not refused — it is silently dropped. {@code linkedin} and
 * {@code linktree} were added on 2026-09-16 and would otherwise have round
 * tripped as nothing at all, with the editor reporting a successful save.
 *
 * <p><strong>The email is not a link, and is deliberately not normalised like
 * one.</strong> {@code hello@yourclub.ca} has no scheme, so
 * {@link WebLinks#normalise} would read it as a bare host and return
 * {@code https://hello@yourclub.ca} — a URI that parses, carries a host, and is
 * nonsense. It is checked as an address instead.
 *
 * <p>What comes back out of {@link #normalise} is <em>our</em> JSON, built from
 * this record, never the client's string handed back. That is the quiet benefit
 * of validating a value we could have stored opaquely: the column holds six
 * known keys in a known order, or NULL.
 */
public record ClubSocialLinks(
        String email,
        String website,
        String facebook,
        String instagram,
        String linkedin,
        String linktree) {

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

    /**
     * Long enough for six real values, short enough not to be a payload.
     *
     * <p>Raised from 2000 with the two 2026-09-16 keys, because this is checked
     * against the <em>incoming</em> string before any field is looked at: six
     * values at {@link #MAX_VALUE_LENGTH} plus their keys exceed 2000, so the
     * old cap would have refused a form the editor itself allows, under a
     * message naming no field.
     */
    private static final int MAX_JSON_LENGTH = 3500;

    private static final int MAX_VALUE_LENGTH = 500;

    /**
     * Checks a client's JSON string and returns ours, or null.
     *
     * @param rawJson the JSON object as submitted; null or blank means not set
     * @return a JSON object carrying all six keys, or null when every value is
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
                        bounded(parsed.instagram(), "Instagram"), "Instagram")),
                // Plain links, like website and facebook — not handles. A club's
                // LinkedIn may be /company/, /school/ or /groups/, which a bare
                // handle cannot express, and Linktree is only ever pasted whole
                // (Arpan, 2026-09-16). This is also what the profile side does
                // with its own linkedin: UserProfileService.java:86-87.
                blankIfNull(WebLinks.normalise(bounded(parsed.linkedin(), "LinkedIn"), "LinkedIn")),
                blankIfNull(WebLinks.normalise(bounded(parsed.linktree(), "Linktree"), "Linktree")));

        if (clean.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(clean);
        } catch (JsonProcessingException e) {
            // Six strings cannot fail to serialise. Not swallowed, because a
            // silent null here would clear a club's links.
            throw new IllegalStateException("Could not serialise club social links", e);
        }
    }

    /**
     * The contact address inside a stored links object, as an official email.
     *
     * <p>A club's official email is seeded from the contact email the create
     * form already collects (Arpan, 2026-09-10), and the proposal path has only
     * that JSON string to read it from — there is one address on the form, and
     * giving a proposal a second column for it would invite the two to
     * disagree.
     *
     * <p><strong>Seeded, not merged.</strong> The two are separate columns with
     * separate rules from the moment the club exists: {@code social_links.email}
     * is public and owner-editable, {@code official_email} is the recovery
     * channel only a platform admin may write ({@code Club.java:36-42}).
     * Changing one later does not move the other, which is the whole point of
     * seeding rather than pointing one at the other.
     *
     * @param json a stored {@code social_links} value, or null
     * @return the address, trimmed and lowercased, or null when there is none
     */
    public static String officialEmailFrom(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            ClubSocialLinks parsed = MAPPER.readValue(json, ClubSocialLinks.class);
            return parsed == null ? null : normaliseOfficialEmail(parsed.email());
        } catch (JsonProcessingException e) {
            // Only ever reads what normalise() wrote, so this cannot happen
            // through the API. Null rather than a throw: a club failing to be
            // created over an unreadable links column would be the worse
            // outcome, and the address is recoverable by an admin.
            return null;
        }
    }

    /**
     * An official email as it is stored: trimmed, lowercased, or null.
     *
     * <p>Lowercased for the same reason {@code ClubAdminService.setOfficialEmail}
     * lowercases it — addresses are compared case-insensitively everywhere in
     * this application, and a club seeded with {@code Hello@x} that an admin
     * later re-sets as {@code hello@x} must not read as a change of address.
     *
     * <p>Validation is the caller's: on both creation paths the same value has
     * already been through {@link #normalise}, which refuses a malformed
     * address with a 400 naming the field.
     */
    public static String normaliseOfficialEmail(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().toLowerCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Every key must be named here. A field left out reads as always-empty, so
     * a club whose only contact is the one that was forgotten would be stored as
     * NULL — the save reporting success and the value gone.
     */
    private boolean isEmpty() {
        return email.isEmpty()
                && website.isEmpty()
                && facebook.isEmpty()
                && instagram.isEmpty()
                && linkedin.isEmpty()
                && linktree.isEmpty();
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
     * All six keys are always written, empty rather than absent. The frontend
     * type says every field is a string, and a missing key would make that a
     * lie at runtime for anything reading a club from the API.
     */
    private static String blankIfNull(String value) {
        return value == null ? "" : value;
    }
}
