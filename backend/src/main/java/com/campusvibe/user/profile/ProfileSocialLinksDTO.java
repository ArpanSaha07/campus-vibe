package com.campusvibe.user.profile;

/**
 * Where else to find someone.
 *
 * <p>The object is always present and each link is null until it is added, so a
 * caller reading one link never has to check two levels. Mirrored by
 * {@code ProfileSocialLinks} in {@code frontend/app/types/index.ts} and pinned
 * by {@code contracts/api-dto-fields.json} — the contract records nested objects
 * as a single field name, so this record has to be contracted in its own right
 * or these three names cross the wire unchecked.
 *
 * <p>Values are http or https URLs; the service refuses anything else on write.
 * The frontend still normalises on render, because a row written before that
 * rule existed would still reach an href.
 */
public record ProfileSocialLinksDTO(
		String instagram,
		String facebook,
		String linkedin
) {}
