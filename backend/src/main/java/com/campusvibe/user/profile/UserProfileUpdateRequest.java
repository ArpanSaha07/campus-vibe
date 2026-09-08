package com.campusvibe.user.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A whole profile, replacing whatever was there.
 *
 * <p><strong>Full replace, not a patch, and the endpoint is PUT for that
 * reason.</strong> The editor is four screens that each own a slice of one
 * profile — bio and links on one, degree and subjects on another, interests on
 * a third — and each of them calls the same save with a complete object built
 * from the profile it loaded. A partial update would have to tell "absent"
 * apart from "null", which a record cannot do without wrapping every component
 * in an Optional; sending the whole thing makes null mean {@code clear this}
 * and nothing else.
 *
 * <p>The corresponding requirement on the frontend is that all four screens
 * read one loaded profile rather than each starting from an empty one.
 * Otherwise a full replace is a full erase.
 *
 * <p>Nulls are tolerated on the collections and on {@code socialLinks} so that a
 * caller may omit them; the service reads them as empty.
 */
public record UserProfileUpdateRequest(
		@Size(max = 500) String bio,
		@Size(max = 200) String faculty,
		@Size(max = 200) String degree,
		List<@Size(max = 100) String> subjects,
		@Valid ProfileSocialLinksRequest socialLinks,
		List<String> interests,
		boolean showInterests,
		boolean showSocialLinks
) {}
