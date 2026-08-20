package com.campusvibe.user.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * What CampusVibe is allowed to email someone.
 *
 * <p>Separate from {@link UserProfile} because the two are read by different
 * code for different reasons: a profile is what other students see, this is what
 * the mail path may send. See V21.
 *
 * <p><strong>The field initialisers below are the meaning of an absent row.</strong>
 * {@link NotificationPreferencesService} returns a transient instance rather than
 * persisting one on read, so these defaults are what someone who has never
 * opened the settings screen gets — and they must stay in step with both the
 * column defaults in V21 and the editor's initial state.
 */
@Entity
@Table(name = "user_notification_preferences")
@Getter
@Setter
@NoArgsConstructor
public class NotificationPreferences {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Column(name = "event_reminders", nullable = false)
	private boolean eventReminders = true;

	@Column(name = "club_announcements", nullable = false)
	private boolean clubAnnouncements = true;

	@Column(name = "weekly_digest", nullable = false)
	private boolean weeklyDigest = true;

	@Column(name = "new_follower_events", nullable = false)
	private boolean newFollowerEvents = true;

	// The one that starts off. Marketing nobody asked for, unlike the four
	// above, which are the reason someone signed up in the first place.
	@Column(name = "product_news", nullable = false)
	private boolean productNews = false;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt = Instant.now();

	public NotificationPreferences(Long userId) {
		this.userId = userId;
	}
}
