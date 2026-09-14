package com.campusvibe.common;

import com.campusvibe.exception.RequestValidationException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Turns something a user typed into a link that is safe to store, or refuses it.
 *
 * <p>This was {@code user.profile.ProfileLinks} and was package-private, which
 * is why a club's social links were never checked at all: the rule existed and
 * club code could not reach it. It lives here now because three callers need
 * it — a user's profile links, a club's contact links on
 * {@code PUT /clubs/&#123;id&#125;}, and the same links on a club proposal.
 *
 * <p>There is a twin of this on the frontend, {@code normaliseWebLink} in
 * {@code app/lib/links.ts}, and it is not redundant with this one. That one runs
 * in the browser and so is not a control at all — it protects the render, and
 * anything holding a token can POST straight past it. This one is the control.
 * The frontend copy stays because a row written before this rule existed would
 * still reach an {@code href}.
 *
 * <p><strong>The order of the two steps below is the entire security
 * property.</strong> A scheme that is already present is checked first, and only
 * a string with no scheme of its own gets {@code https://} put in front of it.
 * Reversed, {@code javascript:alert(1)} becomes
 * {@code https://javascript:alert(1)} — an https URL that sails through a
 * scheme check and lands in an href. There is a test pinning exactly that.
 *
 * <p><strong>Not for email addresses.</strong> {@code hello@yourclub.ca} has no
 * scheme, so it would be turned into {@code https://hello@yourclub.ca} — a URI
 * that parses, carries a host, and is nonsense. An address is checked as an
 * address; see {@code ClubSocialLinks}.
 */
public final class WebLinks {

    /**
     * A scheme as RFC 3986 defines one. Note that dots are legal in a scheme,
     * so {@code instagram.com:443/x} is read as a scheme of
     * {@code instagram.com} and refused rather than guessed at. That is a false
     * refusal for an input nobody types, and the alternative — special-casing
     * anything with a dot — is a rule an attacker gets to aim at.
     */
    private static final Pattern HAS_SCHEME = Pattern.compile("^[a-zA-Z][a-zA-Z0-9+.-]*:");

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    /**
     * An Instagram username: letters, digits, full stops and underscores, up to
     * 30 characters. Deliberately narrow — it is what gets pasted into a URL
     * this class builds, so anything outside it is refused rather than escaped.
     */
    private static final Pattern INSTAGRAM_HANDLE = Pattern.compile("^[A-Za-z0-9._]{1,30}$");

    private static final Set<String> INSTAGRAM_HOSTS = Set.of("instagram.com", "www.instagram.com");

    private static final String INSTAGRAM_PREFIX = "https://instagram.com/";

    private WebLinks() {
    }

    /**
     * The Instagram field, where the user types a handle and we build the URL.
     *
     * <p>Asked for by Arpan on 2026-09-10: a handle is what somebody knows about
     * their own account, and `instagram.com/` in front of it is bookkeeping the
     * form should not make them do. Both the club form and the profile editor
     * collect it that way, and both store the full URL, because that is what
     * ends up in an {@code href}.
     *
     * <p><strong>A pasted URL is accepted too</strong>, and reduced to its
     * handle — people paste, and a form that refuses what the address bar gave
     * them is a form that looks broken. Only Instagram's own host is taken;
     * {@code evil.com/someone} is refused rather than quietly turned into an
     * Instagram link that is not one. The query string goes, so two people who
     * arrived by different routes store the same URL.
     *
     * <p>The handle pattern is checked <em>before</em> anything is concatenated,
     * which is what makes building a URL by string join safe here: nothing that
     * could change the host, add a path segment or carry a scheme survives it.
     *
     * @param raw   what the user typed; null or blank means "not set"
     * @param field the field name, so a refusal says which box to fix
     * @return {@code https://instagram.com/<handle>}, or null
     * @throws RequestValidationException (→ 400) if it is neither a handle nor
     *         an Instagram URL
     */
    public static String normaliseInstagram(String raw, String field) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        // A handle is written @name as often as name, and the @ is not part of
        // it. Stripped once: @@name is not a handle and is refused below.
        if (trimmed.startsWith("@")) {
            trimmed = trimmed.substring(1);
        }
        if (trimmed.isEmpty()) {
            return null;
        }

        // The common case, and checked first because the pattern admits no
        // scheme and no slash -- so nothing that reaches the URL branch below
        // can have been a plain handle.
        if (INSTAGRAM_HANDLE.matcher(trimmed).matches()) {
            return INSTAGRAM_PREFIX + trimmed;
        }

        String handle = handleFromUrl(trimmed);
        if (handle == null || !INSTAGRAM_HANDLE.matcher(handle).matches()) {
            throw new RequestValidationException(
                    "%s should be your Instagram handle, like yourclub".formatted(field));
        }
        return INSTAGRAM_PREFIX + handle;
    }

    /** The first path segment of an Instagram URL, or null if it is not one. */
    private static String handleFromUrl(String raw) {
        URI uri;
        try {
            // Through normalise so the scheme rule is the same one everything
            // else here obeys, and so a bare instagram.com/x is understood.
            uri = new URI(normalise(raw, "Instagram"));
        } catch (URISyntaxException | RequestValidationException e) {
            return null;
        }
        if (uri.getHost() == null
                || !INSTAGRAM_HOSTS.contains(uri.getHost().toLowerCase(Locale.ROOT))) {
            return null;
        }
        String path = uri.getPath() == null ? "" : uri.getPath();
        String[] segments = path.split("/");
        // segments[0] is the empty string before the leading slash.
        return segments.length < 2 ? null : segments[1];
    }

    /**
     * @param raw   what the user typed; null or blank means "not set"
     * @param field the field name, so a refusal says which box to fix
     * @return an absolute http(s) URL, or null
     * @throws RequestValidationException (→ 400) if it cannot be made into one
     */
    public static String normalise(String raw, String field) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        String candidate;
        if (HAS_SCHEME.matcher(trimmed).find()) {
            String scheme = trimmed.substring(0, trimmed.indexOf(':')).toLowerCase(Locale.ROOT);
            if (!ALLOWED_SCHEMES.contains(scheme)) {
                throw new RequestValidationException(
                        "%s must be a http or https link".formatted(field));
            }
            candidate = trimmed;
        } else {
            // No scheme of its own -- the usual way somebody types a profile
            // link. Safe to assume https only because the branch above has
            // already refused every scheme we do not allow.
            candidate = "https://" + trimmed;
        }

        URI uri;
        try {
            uri = new URI(candidate);
        } catch (URISyntaxException e) {
            throw new RequestValidationException("%s is not a valid link".formatted(field));
        }

        // A URL with no host is not somewhere anyone can go, and is how most of
        // the odd inputs that survive the scheme check end up looking.
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new RequestValidationException("%s is not a valid link".formatted(field));
        }

        return uri.toString();
    }
}
