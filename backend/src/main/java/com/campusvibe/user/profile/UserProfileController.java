package com.campusvibe.user.profile;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in user's profile and email preferences.
 *
 * <p>Scoped to "me" exactly as {@code MyEventController} and
 * {@code MyClubController} are: the acting user comes from the JWT, never from a
 * path variable, so one user can never read or change another's.
 *
 * <p>Authentication is enforced by {@code SecurityFilterChainConfig} — nothing
 * under {@code /api/v1/users/me} is in a permitAll list, so these fall through
 * to {@code .anyRequest().authenticated()} and need no entry of their own.
 *
 * <p>PUT rather than PATCH on both writes, and that is a statement about the
 * body: it replaces everything. See {@link UserProfileUpdateRequest}.
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class UserProfileController {

	private final UserProfileService userProfileService;
	private final NotificationPreferencesService notificationPreferencesService;

	public UserProfileController(UserProfileService userProfileService,
	                             NotificationPreferencesService notificationPreferencesService) {
		this.userProfileService = userProfileService;
		this.notificationPreferencesService = notificationPreferencesService;
	}

	@GetMapping("/profile")
	public UserProfileDTO myProfile(Authentication authentication) {
		return userProfileService.getMyProfile(authentication.getName());
	}

	// Answers with the stored profile rather than 204, so the client renders
	// what was actually saved -- links are rewritten on the way in, and a blank
	// field comes back null, neither of which the submitted body shows.
	@PutMapping("/profile")
	public UserProfileDTO replaceMyProfile(Authentication authentication,
	                                       @Valid @RequestBody UserProfileUpdateRequest request) {
		return userProfileService.replaceMyProfile(authentication.getName(), request);
	}

	@GetMapping("/notification-preferences")
	public NotificationPreferencesDTO myNotificationPreferences(Authentication authentication) {
		return notificationPreferencesService.getMyPreferences(authentication.getName());
	}

	@PutMapping("/notification-preferences")
	public NotificationPreferencesDTO replaceMyNotificationPreferences(
			Authentication authentication,
			@Valid @RequestBody NotificationPreferencesUpdateRequest request) {
		return notificationPreferencesService.replaceMyPreferences(
				authentication.getName(), request);
	}
}
