package com.campusvibe.user.profile;

import java.util.List;

/**
 * A user's profile as the wire sees it.
 *
 * <p>Mirrors {@code UserProfile} in {@code frontend/app/types/index.ts}, and is
 * deliberately <strong>not</strong> folded into {@code UserDTO}: the frontend's
 * contract test keys on {@code Record<keyof User, true>}, so a field added to
 * {@code User} fails type-check until the backend serialises it too. Keeping the
 * two apart is that guard working as intended, not a workaround for it.
 *
 * <p>Collections are always present and empty rather than null, matching
 * {@code emptyProfile()} — the editor binds controlled inputs to these and a
 * null would flip one to uncontrolled.
 *
 * <p>{@code interests} carries catalogue <em>slugs</em>, not labels. Labels are
 * fetched once from {@code GET /api/v1/interests} and can be revised without
 * touching anybody's selections; see V19.
 */
public record UserProfileDTO(
		String bio,
		String faculty,
		String degree,
		List<String> subjects,
		ProfileSocialLinksDTO socialLinks,
		List<String> interests,
		boolean showInterests,
		boolean showSocialLinks
) {}
