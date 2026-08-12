package com.campusvibe.user;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.event.Event;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MyEventsIT extends AbstractIntegrationTest {

	private String json(Object body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	private Event createEvent(String title, Club club, Instant when) {
		Event event = new Event();
		event.setTitle(title);
		event.setOrganizer(club);
		event.setDateTime(when);
		return eventRepository.save(event);
	}

	private void save(User user, Event event) throws Exception {
		mockMvc.perform(post("/api/v1/users/me/saved-events")
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("eventId", event.getId()))))
				.andExpect(status().isNoContent());
	}

	private void rsvp(User user, Event event) throws Exception {
		mockMvc.perform(post("/api/v1/users/me/rsvps")
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("eventId", event.getId()))))
				.andExpect(status().isNoContent());
	}

	@Test
	void myEventsRequiresAuthentication() throws Exception {
		// 403, not 401: DelegatedAuthEntryPoint hands AuthenticationException to
		// DefaultExceptionHandler, which answers 403 app-wide. Matches the
		// existing expectations in AuthenticationFlowIT.
		mockMvc.perform(get("/api/v1/users/me/events"))
				.andExpect(status().isForbidden());
	}

	@Test
	void savingAndRsvpingSetIndependentFlags() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		Club club = createClub("chess-club", "Chess Club");
		Event savedOnly = createEvent("Saved only", club, Instant.parse("2026-10-01T18:00:00Z"));
		Event goingOnly = createEvent("Going only", club, Instant.parse("2026-10-02T18:00:00Z"));
		Event both = createEvent("Both", club, Instant.parse("2026-10-03T18:00:00Z"));

		save(user, savedOnly);
		rsvp(user, goingOnly);
		save(user, both);
		rsvp(user, both);

		// Sorted by dateTime, so the order below is deterministic.
		mockMvc.perform(get("/api/v1/users/me/events").header("Authorization", bearer(user)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].event.title", is("Saved only")))
				.andExpect(jsonPath("$[0].saved", is(true)))
				.andExpect(jsonPath("$[0].going", is(false)))
				.andExpect(jsonPath("$[1].event.title", is("Going only")))
				.andExpect(jsonPath("$[1].saved", is(false)))
				.andExpect(jsonPath("$[1].going", is(true)))
				.andExpect(jsonPath("$[2].event.title", is("Both")))
				.andExpect(jsonPath("$[2].saved", is(true)))
				.andExpect(jsonPath("$[2].going", is(true)));
	}

	@Test
	void unsavingLeavesTheRsvpIntact() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		Club club = createClub("chess-club", "Chess Club");
		Event event = createEvent("Chess night", club, Instant.parse("2026-10-01T18:00:00Z"));

		save(user, event);
		rsvp(user, event);

		mockMvc.perform(delete("/api/v1/users/me/saved-events/" + event.getId())
						.header("Authorization", bearer(user)))
				.andExpect(status().isNoContent());

		// Still going — un-bookmarking is not the same as cancelling.
		mockMvc.perform(get("/api/v1/users/me/events").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].saved", is(false)))
				.andExpect(jsonPath("$[0].going", is(true)));

		mockMvc.perform(delete("/api/v1/users/me/rsvps/" + event.getId())
						.header("Authorization", bearer(user)))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/v1/users/me/events").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void savingTheSameEventTwiceIsANoOp() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		Club club = createClub("chess-club", "Chess Club");
		Event event = createEvent("Chess night", club, Instant.parse("2026-10-01T18:00:00Z"));

		save(user, event);
		save(user, event);

		mockMvc.perform(get("/api/v1/users/me/events").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(1)));
	}

	@Test
	void savingAnUnknownEventIs404() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(post("/api/v1/users/me/saved-events")
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("eventId", 9999))))
				.andExpect(status().isNotFound());
	}

	@Test
	void oneUsersSavedEventsAreInvisibleToAnother() throws Exception {
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		User ben = createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);
		Club club = createClub("chess-club", "Chess Club");
		Event event = createEvent("Chess night", club, Instant.parse("2026-10-01T18:00:00Z"));

		save(uma, event);

		mockMvc.perform(get("/api/v1/users/me/events").header("Authorization", bearer(ben)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}
}
