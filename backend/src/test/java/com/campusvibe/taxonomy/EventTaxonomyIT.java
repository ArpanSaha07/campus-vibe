package com.campusvibe.taxonomy;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.clubadmin.ClubRole;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * An event's two axes: formats for what kind of thing it is, topics for what it
 * is about.
 *
 * <p>There is deliberately no event category — see decision D2. Format is a tag
 * drawn from {@code event_formats}, which is the event's own vocabulary, and
 * topic is drawn from the interest catalogue, shared with students and clubs.
 * That sharing is what makes matching a person to an event a direct join with
 * no mapping.
 */
class EventTaxonomyIT extends AbstractIntegrationTest {

	private Map<String, Object> body(String clubId, List<String> topics, List<String> formats) {
		Map<String, Object> request = new HashMap<>();
		request.put("title", "Intro to Robotics");
		request.put("description", "Bring a laptop.");
		request.put("dateTime", Instant.parse("2026-09-01T18:00:00Z").toString());
		request.put("location", "Trottier 1080");
		request.put("price", null);
		request.put("organizerId", clubId);
		request.put("capacity", 30);
		request.put("topics", topics);
		request.put("formats", formats);
		return request;
	}

	private User ownerOf(Club club) {
		User owner = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		grantClubRole(club, owner, ClubRole.CLUB_OWNER);
		return owner;
	}

	@Test
	void anEventCarriesBothAxes() throws Exception {
		Club club = createClub("robotics", "Robotics Team");
		User owner = ownerOf(club);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("robotics", List.of("robotics", "ai-machine-learning"),
										List.of("workshop")))))
				.andExpect(status().isOk())
				// Both sorted, so two reads of one row cannot disagree.
				.andExpect(jsonPath("$.topics", contains("ai-machine-learning", "robotics")))
				.andExpect(jsonPath("$.formats", contains("workshop")));
	}

	@Test
	void anEventCanBeTaggedWithAnInterestGroup() throws Exception {
		// A jam night is about `music` and nothing narrower. V26 made the
		// twelve groups rows precisely so that is expressible.
		Club club = createClub("jazz-band", "Jazz Band");
		User owner = ownerOf(club);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("jazz-band", List.of("music"), List.of("performance")))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topics", contains("music")));
	}

	@Test
	void anEventNeedsNeitherTopicsNorFormats() throws Exception {
		// Both are optional. An event with a title and a date is a real event,
		// and refusing to create one until it is tagged would be a worse
		// outcome than an untagged event nobody finds.
		Club club = createClub("robotics", "Robotics Team");
		User owner = ownerOf(club);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("robotics", List.of(), List.of()))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topics", hasSize(0)))
				.andExpect(jsonPath("$.formats", hasSize(0)));
	}

	@Test
	void aFormatIsNotATopicAndTheTablesEnforceIt() throws Exception {
		// `workshop` lives only in event_formats. Sending it as a topic must be
		// refused rather than quietly accepted -- the two vocabularies being
		// separate tables is what makes that impossible to get wrong by
		// accident, where a single table with a kind column would not.
		Club club = createClub("robotics", "Robotics Team");
		User owner = ownerOf(club);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("robotics", List.of("workshop"), List.of()))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("workshop")));
	}

	@Test
	void anUnknownFormatIsRefused() throws Exception {
		Club club = createClub("robotics", "Robotics Team");
		User owner = ownerOf(club);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("robotics", List.of(), List.of("silent-disco")))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("silent-disco")));
	}

	@Test
	void creatingAnEventStillRequiresManagingItsClub() throws Exception {
		// Nothing about tagging weakens who may create an event. This is also
		// why the form offers only clubs the user manages -- anything else
		// would only produce this.
		createClub("robotics", "Robotics Team");
		User stranger = createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(post("/api/v1/events")
						.header("Authorization", bearer(stranger))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("robotics", List.of("robotics"), List.of("workshop")))))
				.andExpect(status().isForbidden());
	}
}
