package com.campusvibe.user.profile;

/**
 * All five switches at once.
 *
 * <p>Primitive booleans, so a missing key is {@code false} rather than null.
 * That is the right reading here and only here: the screen renders every switch
 * and submits every switch, and the alternative — boxed Booleans with
 * null-means-untouched — would let a truncated body silently leave someone
 * subscribed to something they had just turned off.
 */
public record NotificationPreferencesUpdateRequest(
		boolean eventReminders,
		boolean clubAnnouncements,
		boolean weeklyDigest,
		boolean newFollowerEvents,
		boolean productNews
) {}
