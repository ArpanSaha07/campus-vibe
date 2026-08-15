package com.campusvibe.event;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What GET /api/v1/events/{id} answers for ids that do and do not name an
 * event. The frontend event page turns these statuses directly into screens —
 * 404 into notFound(), anything else into an error boundary — so a wrong status
 * here shows the user the wrong page.
 */
class EventLookupIT extends AbstractIntegrationTest {

	private Event createEvent(String title, Club club, Instant when) {
		Event event = new Event();
		event.setTitle(title);
		event.setOrganizer(club);
		event.setDateTime(when);
		return eventRepository.save(event);
	}

	@Test
	void servesAnEventThatExists() throws Exception {
		Club club = createClub("chess-club", "Chess Club");
		Event event = createEvent("Chess night", club, Instant.parse("2026-10-01T18:00:00Z"));

		mockMvc.perform(get("/api/v1/events/" + event.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title", is("Chess night")))
				// The frontend needs this to link and follow the organizing club.
				.andExpect(jsonPath("$.organizerId", is("chess-club")));
	}

	/**
	 * The name travels with the event so a card can print it without fetching
	 * the club. The club here is deliberately named nothing like its slug: the
	 * frontend used to derive the name by title-casing the id, which would give
	 * `Startup Montreal` and be wrong every time for a club like this one.
	 */
	@Test
	void carriesTheOrganizerNameNotJustItsId() throws Exception {
		Club club = createClub("startup-montreal", "Making Waves Montreal");
		Event event = createEvent("Demo night", club, Instant.parse("2026-10-01T18:00:00Z"));

		mockMvc.perform(get("/api/v1/events/" + event.getId()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.organizerId", is("startup-montreal")))
				.andExpect(jsonPath("$.organizerName", is("Making Waves Montreal")));
	}

	@Test
	void theListCarriesOrganizerNamesToo() throws Exception {
		Club chess = createClub("chess-club", "Chess Club");
		Club waves = createClub("startup-montreal", "Making Waves Montreal");
		createEvent("Chess night", chess, Instant.parse("2026-10-01T18:00:00Z"));
		createEvent("Demo night", waves, Instant.parse("2026-10-02T18:00:00Z"));

		// Reading the name initializes the lazy organizer proxy, so without the
		// @EntityGraph on EventRepository.findAll this list would be N+1.
		mockMvc.perform(get("/api/v1/events"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.title == 'Chess night')].organizerName",
						contains("Chess Club")))
				.andExpect(jsonPath("$[?(@.title == 'Demo night')].organizerName",
						contains("Making Waves Montreal")));
	}

	@Test
	void publicReadNeedsNoToken() throws Exception {
		Club club = createClub("chess-club", "Chess Club");
		Event event = createEvent("Chess night", club, Instant.parse("2026-10-01T18:00:00Z"));

		// No Authorization header: event pages are shareable links.
		mockMvc.perform(get("/api/v1/events/" + event.getId()))
				.andExpect(status().isOk());
	}

	@Test
	void unknownNumericIdIs404() throws Exception {
		mockMvc.perform(get("/api/v1/events/999999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.statusCode", is(404)));
	}

	/**
	 * A slug cannot convert to the Long the controller takes. That used to fall
	 * through to the catch-all Exception handler and answer 500 — claiming a
	 * server fault for what is a malformed request. The old hardcoded event page
	 * shipped exactly such an id ("dance-party"), so this was reachable from the
	 * UI rather than only by hand.
	 */
	@Test
	void nonNumericIdIs400NotAServerError() throws Exception {
		mockMvc.perform(get("/api/v1/events/dance-party"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.statusCode", is(400)))
				// The raw message names the Java type and controller parameter;
				// it must not be echoed to the caller.
				.andExpect(jsonPath("$.message", is("Invalid value for 'id'")));
	}

	@Test
	void aDecimalIdIsAlso400() throws Exception {
		mockMvc.perform(get("/api/v1/events/1.5"))
				.andExpect(status().isBadRequest());
	}
}
