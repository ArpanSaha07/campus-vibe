package com.campusvibe.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A change to the account itself, as opposed to the profile hanging off it.
 *
 * <p>Only the display name. The email address is deliberately absent: it is the
 * login identifier, so changing it without proving control of the new inbox
 * locks the account out. That needs a confirm-by-mail round trip through
 * {@code AuthTokenService}, which is its own piece of work — until then
 * {@code /profile/edit/account} keeps its email field local and says so.
 *
 * <p>80 to match the {@code maxLength} on the name input in
 * {@code app/(protected)/profile/edit/page.tsx}.
 */
public record UserUpdateRequest(
		@NotBlank @Size(max = 80) String name
) {}
