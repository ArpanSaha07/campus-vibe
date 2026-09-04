package com.campusvibe.user.profile;

import com.campusvibe.exception.RequestValidationException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Turns something a user typed into a link that is safe to store, or refuses it.
 *
 * <p>There is a twin of this on the frontend, {@code normaliseProfileLink} in
 * {@code app/lib/profile.ts}, and it is not redundant with this one. That one
 * runs in the browser and so is not a control at all — it protects the render,
 * and anything holding a token can POST straight past it. This one is the
 * control. The frontend copy stays because a row written before this rule
 * existed would still reach an {@code href}.
 *
 * <p><strong>The order of the two steps below is the entire security
 * property.</strong> A scheme that is already present is checked first, and only
 * a string with no scheme of its own gets {@code https://} put in front of it.
 * Reversed, {@code javascript:alert(1)} becomes
 * {@code https://javascript:alert(1)} — an https URL that sails through a
 * scheme check and lands in an href. There is a test pinning exactly that.
 */
final class ProfileLinks {

	/**
	 * A scheme as RFC 3986 defines one. Note that dots are legal in a scheme,
	 * so {@code instagram.com:443/x} is read as a scheme of
	 * {@code instagram.com} and refused rather than guessed at. That is a false
	 * refusal for an input nobody types, and the alternative — special-casing
	 * anything with a dot — is a rule an attacker gets to aim at.
	 */
	private static final Pattern HAS_SCHEME = Pattern.compile("^[a-zA-Z][a-zA-Z0-9+.-]*:");

	private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

	private ProfileLinks() {
	}

	/**
	 * @param raw   what the user typed; null or blank means "not set"
	 * @param field the field name, so a refusal says which box to fix
	 * @return an absolute http(s) URL, or null
	 * @throws RequestValidationException (→ 400) if it cannot be made into one
	 */
	static String normalise(String raw, String field) {
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
