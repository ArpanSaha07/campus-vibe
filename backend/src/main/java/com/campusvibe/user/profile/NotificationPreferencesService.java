package com.campusvibe.user.profile;

import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and replaces the signed-in user's email preferences.
 *
 * <p>A read with no row returns a transient {@link NotificationPreferences}
 * rather than persisting one. Writing on read would turn every visit to the
 * settings screen into an INSERT, and — worse — would freeze today's defaults
 * into rows for people who never touched a switch, so changing a default later
 * would only affect accounts that had never looked. The entity's field
 * initialisers are the defaults, and they stay authoritative until someone
 * actually chooses.
 */
@Service
public class NotificationPreferencesService {

	private final NotificationPreferencesRepository preferencesRepository;
	private final UserRepository userRepository;
	private final NotificationPreferencesMapper mapper;

	public NotificationPreferencesService(NotificationPreferencesRepository preferencesRepository,
	                                      UserRepository userRepository,
	                                      NotificationPreferencesMapper mapper) {
		this.preferencesRepository = preferencesRepository;
		this.userRepository = userRepository;
		this.mapper = mapper;
	}

	@Transactional(readOnly = true)
	public NotificationPreferencesDTO getMyPreferences(String email) {
		Long userId = requireUser(email).getId();
		return mapper.apply(preferencesRepository.findById(userId)
				.orElseGet(() -> new NotificationPreferences(userId)));
	}

	@Transactional
	public NotificationPreferencesDTO replaceMyPreferences(
			String email, NotificationPreferencesUpdateRequest request) {

		Long userId = requireUser(email).getId();
		NotificationPreferences preferences = preferencesRepository.findById(userId)
				.orElseGet(() -> new NotificationPreferences(userId));

		preferences.setEventReminders(request.eventReminders());
		preferences.setClubAnnouncements(request.clubAnnouncements());
		preferences.setWeeklyDigest(request.weeklyDigest());
		preferences.setNewFollowerEvents(request.newFollowerEvents());
		preferences.setProductNews(request.productNews());

		return mapper.apply(preferencesRepository.save(preferences));
	}

	private User requireUser(String email) {
		return userRepository.findByEmail(email)
				.orElseThrow(() -> new ResourceNotFoundException(
						"User with email [%s] not found".formatted(email)));
	}
}
