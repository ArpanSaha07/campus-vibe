package com.campusvibe.taxonomy;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.clubadmin.ClubRole;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The two axes a club carries: one category for what kind of organisation it
 * is, and several interest tags for what it is about.
 *
 * <p>The tags are the half that does the finding — thirteen category labels
 * cannot answer <em>show me AI clubs</em> at any multiplicity. See decisions D1
 * and D7.
 */
class ClubTaxonomyIT extends AbstractIntegrationTest {

	private Map<String, Object> body(String category, List<String> interests) {
		Map<String, Object> request = new HashMap<>();
		request.put("name", null);
		request.put("description", null);
		request.put("socialLinks", null);
		request.put("category", category);
		request.put("interests", interests);
		return request;
	}

	private void update(User owner, String clubId, Map<String, Object> body, int expected)
			throws Exception {
		mockMvc.perform(put("/api/v1/clubs/" + clubId)
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body)))
				.andExpect(status().is(expected));
	}

	private User ownerOf(Club club) {
		User owner = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		grantClubRole(club, owner, ClubRole.CLUB_OWNER);
		return owner;
	}

	// ------------------------------------------------------- the vocabularies

	@Test
	void bothNewVocabulariesArePublic() throws Exception {
		// No token on either. They name nobody, are identical for every caller,
		// and a public club or event page has to render the label behind a slug
		// with nothing to authenticate as.
		mockMvc.perform(get("/api/v1/club-categories"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(13)))
				.andExpect(jsonPath("$[0].slug", is("athletic-and-recreational-sports")));

		mockMvc.perform(get("/api/v1/event-formats"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(22)))
				.andExpect(jsonPath("$[0].slug", is("workshop")))
				.andExpect(jsonPath("$[0].groupLabel", is("Learning")));
	}

	// ------------------------------------------------------------ the club

	@Test
	void aClubStartsWithNoCategoryAndNoTags() throws Exception {
		// Every club predates V23, so uncategorised is an ordinary state rather
		// than an error, and there is no default that would have been true.
		createClub("chess-club", "Chess Club");

		mockMvc.perform(get("/api/v1/clubs/chess-club"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.category", is(nullValue())))
				.andExpect(jsonPath("$.interests", hasSize(0)));
	}

	@Test
	void aCategoryAndTagsRoundTrip() throws Exception {
		Club club = createClub("cs-society", "CS Undergraduate Society");
		User owner = ownerOf(club);

		// The example the whole design is for: a departmental society that is
		// findable under tech, which its category alone could never make it.
		update(owner, "cs-society",
				body("departmental", List.of("web-development", "ai-machine-learning", "hackathons")),
				200);

		mockMvc.perform(get("/api/v1/clubs/cs-society"))
				.andExpect(jsonPath("$.category", is("departmental")))
				// Sorted, so two reads of one row cannot disagree about order.
				.andExpect(jsonPath("$.interests",
						contains("ai-machine-learning", "hackathons", "web-development")));
	}

	@Test
	void tagsAreReplacedRatherThanMerged() throws Exception {
		// The form sends the whole set, so an absent slug means removed.
		Club club = createClub("cs-society", "CS Undergraduate Society");
		User owner = ownerOf(club);

		update(owner, "cs-society", body("departmental", List.of("chess", "hiking")), 200);
		update(owner, "cs-society", body("departmental", List.of("chess")), 200);

		mockMvc.perform(get("/api/v1/clubs/cs-society"))
				.andExpect(jsonPath("$.interests", contains("chess")));
	}

	@Test
	void aClubCanBeTaggedWithAnInterestGroup() throws Exception {
		// V26 made the twelve groups rows, so `tech` is a legal tag and not
		// only its narrower children.
		Club club = createClub("robotics", "Robotics Team");
		User owner = ownerOf(club);

		update(owner, "robotics", body("departmental", List.of("tech", "robotics")), 200);

		mockMvc.perform(get("/api/v1/clubs/robotics"))
				.andExpect(jsonPath("$.interests", contains("robotics", "tech")));
	}

	@Test
	void aClubCanBeClassifiedAtCreation() throws Exception {
		// Creation is the only moment a creator can set these: PUT demands
		// canManageClub, and creating a club does not make you its owner. So
		// the create request carries them, or a new club could never say what
		// it is until somebody else granted ownership.
		User anyone = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		Map<String, Object> create = new HashMap<>();
		create.put("id", "quantum-society");
		create.put("name", "Quantum Society");
		create.put("description", "Quantum computing, badly explained.");
		create.put("category", "departmental");
		create.put("interests", List.of("tech", "research"));

		mockMvc.perform(post("/api/v1/clubs")
						.header("Authorization", bearer(anyone))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(create)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.category", is("departmental")))
				.andExpect(jsonPath("$.interests", contains("research", "tech")));
	}

	@Test
	void abadSlugRefusesTheWholeCreation() throws Exception {
		// Validated before the insert, so a misclassified club never exists at
		// all rather than existing and being wrong.
		User anyone = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		Map<String, Object> create = new HashMap<>();
		create.put("id", "quantum-society");
		create.put("name", "Quantum Society");
		create.put("description", null);
		create.put("category", "secret-society");
		create.put("interests", List.of());

		mockMvc.perform(post("/api/v1/clubs")
						.header("Authorization", bearer(anyone))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(create)))
				.andExpect(status().isBadRequest());

		mockMvc.perform(get("/api/v1/clubs/quantum-society"))
				.andExpect(status().isNotFound());
	}

	// ------------------------------------------------------------ refusals

	@Test
	void anUnknownCategoryIsRefused() throws Exception {
		// A 400 naming the slug, rather than the foreign key surfacing as a 500.
		Club club = createClub("chess-club", "Chess Club");
		User owner = ownerOf(club);

		mockMvc.perform(put("/api/v1/clubs/chess-club")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body("secret-society", List.of()))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("secret-society")));
	}

	@Test
	void anUnknownInterestIsRefused() throws Exception {
		Club club = createClub("chess-club", "Chess Club");
		User owner = ownerOf(club);

		mockMvc.perform(put("/api/v1/clubs/chess-club")
						.header("Authorization", bearer(owner))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(
								body("general", List.of("chess", "competitive-napping")))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("competitive-napping")));
	}

	@Test
	void moreThanEightTagsIsRefused() throws Exception {
		// The cap is the whole defence against tag spam: a club tagged with
		// everything matches every student, which helps it not at all and
		// degrades recommendations for everybody else. The picker caps itself;
		// this is for everything that is not the picker.
		Club club = createClub("chess-club", "Chess Club");
		User owner = ownerOf(club);

		List<String> nine = IntStream.range(0, 9)
				.mapToObj(n -> List.of("chess", "hiking", "jazz", "yoga", "trivia",
								"cooking", "karaoke", "running", "camping").get(n))
				.toList();

		update(owner, "chess-club", body("general", nine), 400);
	}

	@Test
	void taggingRequiresAuthority() throws Exception {
		// Nothing here weakens who may edit a club: the same canManageClub check
		// guards these fields as guards the name.
		createClub("chess-club", "Chess Club");
		User stranger = createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(put("/api/v1/clubs/chess-club")
						.header("Authorization", bearer(stranger))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body("general", List.of("chess")))))
				.andExpect(status().isForbidden());
	}
}
