package com.campusvibe.user.profile;

import org.springframework.stereotype.Component;

import java.util.function.Function;

/** Preferences to wire shape. */
@Component
public class NotificationPreferencesMapper
		implements Function<NotificationPreferences, NotificationPreferencesDTO> {

	@Override
	public NotificationPreferencesDTO apply(NotificationPreferences preferences) {
		return new NotificationPreferencesDTO(
				preferences.isEventReminders(),
				preferences.isClubAnnouncements(),
				preferences.isWeeklyDigest(),
				preferences.isNewFollowerEvents(),
				preferences.isProductNews());
	}
}
