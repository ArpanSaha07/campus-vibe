package com.campusvibe.user.profile;

/**
 * The five email switches. Mirrors {@code NotificationPreferences} in
 * {@code frontend/app/types/index.ts}.
 *
 * <p>Nothing here can silence a password reset or an email confirmation. Those
 * are transactional — the person asked for each one — and a preference that
 * could stop them would lock someone out of their own account.
 */
public record NotificationPreferencesDTO(
		boolean eventReminders,
		boolean clubAnnouncements,
		boolean weeklyDigest,
		boolean newFollowerEvents,
		boolean productNews
) {}
