package com.campusvibe.user;

import com.campusvibe.event.EventDTO;

/**
 * An event plus the signed-in user's relationship to it.
 *
 * Both flags travel together because they are independent: an event can be
 * saved, going, or both. Collapsing them into a single status here would throw
 * away the state the "saved" heart needs on an event the user is going to.
 */
public record MyEventDTO(
		EventDTO event,
		boolean going,
		boolean saved
) {}
