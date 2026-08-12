package com.campusvibe.user;

import com.campusvibe.event.EventMapper;
import com.campusvibe.event.EventRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The signed-in user's saved events and RSVPs — the data behind the My events
 * page.
 *
 * Saving and RSVPing are runtime data, so they are written here through the
 * normal service path and never seeded through Flyway
 * (see .claude/skills/database-lifecycle).
 */
@Service
public class MyEventService {

	private final UserRepository userRepository;
	private final EventRepository eventRepository;
	private final EventMapper eventMapper;

	public MyEventService(UserRepository userRepository,
	                      EventRepository eventRepository,
	                      EventMapper eventMapper) {
		this.userRepository = userRepository;
		this.eventRepository = eventRepository;
		this.eventMapper = eventMapper;
	}

	/**
	 * Every event the user has saved or is going to, in one response.
	 *
	 * The Going / Saved / Past tabs are three views of this one list, so the page
	 * splits them client-side rather than paying for a request per tab.
	 */
	@Transactional(readOnly = true)
	public List<MyEventDTO> listMyEvents(String email) {
		User user = requireUser(email);
		Set<Long> saved = user.getSavedEventIds();
		Set<Long> going = user.getGoingEventIds();

		Set<Long> linkedIds = new HashSet<>(saved);
		linkedIds.addAll(going);
		if (linkedIds.isEmpty()) {
			return List.of();
		}

		// findAllById quietly skips ids with no row, which is what we want: an
		// event deleted out from under a bookmark should vanish, not 500.
		return eventRepository.findAllById(linkedIds).stream()
				.map(event -> new MyEventDTO(
						eventMapper.apply(event),
						going.contains(event.getId()),
						saved.contains(event.getId())))
				.sorted(Comparator.comparing((MyEventDTO dto) -> dto.event().dateTime(),
						Comparator.nullsLast(Comparator.<Instant>naturalOrder())))
				.toList();
	}

	// Adding to a Set makes these idempotent: saving twice is a no-op rather
	// than a primary-key violation, so a double-tapped heart cannot 500.

	@Transactional
	public void saveEvent(String email, Long eventId) {
		requireEventExists(eventId);
		requireUser(email).getSavedEventIds().add(eventId);
	}

	@Transactional
	public void unsaveEvent(String email, Long eventId) {
		requireUser(email).getSavedEventIds().remove(eventId);
	}

	@Transactional
	public void rsvp(String email, Long eventId) {
		requireEventExists(eventId);
		requireUser(email).getGoingEventIds().add(eventId);
	}

	@Transactional
	public void cancelRsvp(String email, Long eventId) {
		requireUser(email).getGoingEventIds().remove(eventId);
	}

	private User requireUser(String email) {
		return userRepository.findByEmail(email)
				.orElseThrow(() -> new ResourceNotFoundException(
						"User with email [%s] not found".formatted(email)));
	}

	private void requireEventExists(Long eventId) {
		if (!eventRepository.existsById(eventId)) {
			throw new ResourceNotFoundException(
					"Event with id [%s] not found".formatted(eventId));
		}
	}
}
