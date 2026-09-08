package com.campusvibe.user.profile;

import jakarta.validation.constraints.Size;

/**
 * The three links as submitted. Null or blank means "not set".
 *
 * <p>No {@code @URL} or {@code @Pattern} here: people type
 * {@code instagram.com/someone} far more often than a full URL, and a
 * constraint strict enough to be a security control would reject the common
 * case. {@code UserProfileService} normalises and refuses instead, which is
 * where the http/https rule lives.
 */
public record ProfileSocialLinksRequest(
		@Size(max = 500) String instagram,
		@Size(max = 500) String facebook,
		@Size(max = 500) String linkedin
) {}
