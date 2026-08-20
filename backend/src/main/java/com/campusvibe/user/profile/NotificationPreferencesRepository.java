package com.campusvibe.user.profile;

import org.springframework.data.jpa.repository.JpaRepository;

/** Email preferences by user id. Same shared-key arrangement as profiles. */
public interface NotificationPreferencesRepository
		extends JpaRepository<NotificationPreferences, Long> {
}
