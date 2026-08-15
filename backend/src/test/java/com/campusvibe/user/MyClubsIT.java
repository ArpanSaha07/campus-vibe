package com.campusvibe.user;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MyClubsIT extends AbstractIntegrationTest {

	private String json(Object body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	private void follow(User user, String clubId) throws Exception {
		mockMvc.perform(post("/api/v1/users/me/followed-clubs")
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("clubId", clubId))))
				.andExpect(status().isNoContent());
	}

	private void unfollow(User user, String clubId) throws Exception {
		mockMvc.perform(delete("/api/v1/users/me/followed-clubs/" + clubId)
						.header("Authorization", bearer(user)))
				.andExpect(status().isNoContent());
	}

	private int followersOf(String clubId) {
		return clubRepository.findById(clubId).orElseThrow().getFollowers();
	}

	@Test
	void myClubsRequiresAuthentication() throws Exception {
		// 403, not 401: DelegatedAuthEntryPoint hands AuthenticationException to
		// DefaultExceptionHandler, which answers 403 app-wide. Same expectation
		// as MyEventsIT.
		mockMvc.perform(get("/api/v1/users/me/clubs"))
				.andExpect(status().isForbidden());
	}

	@Test
	void followingIsRejectedWithoutAToken() throws Exception {
		createClub("chess-club", "Chess Club");

		mockMvc.perform(post("/api/v1/users/me/followed-clubs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("clubId", "chess-club"))))
				.andExpect(status().isForbidden());

		// The write must not have happened — an anonymous click changes nothing.
		assertThat(followersOf("chess-club")).isZero();
	}

	@Test
	void aNewUserFollowsNothing() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(user)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void followedClubsComeBackAlphabeticallyWithTheirDetails() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		createClub("chess-club", "Chess Club");
		createClub("art-society", "Art Society");
		createClub("drama-troupe", "Drama Troupe");

		follow(user, "chess-club");
		follow(user, "art-society");

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(user)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].id", is("art-society")))
				.andExpect(jsonPath("$[0].name", is("Art Society")))
				.andExpect(jsonPath("$[1].id", is("chess-club")))
				// The club the user did not follow stays out of the list.
				.andExpect(jsonPath("$[*].id", not(hasItem("drama-troupe"))));
	}

	@Test
	void followingRaisesTheClubsFollowerCount() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		Club club = createClub("chess-club", "Chess Club");
		club.setFollowers(45); // as V6 seeds the real ones
		clubRepository.save(club);

		follow(user, "chess-club");

		assertThat(followersOf("chess-club")).isEqualTo(46);
	}

	@Test
	void followingTheSameClubTwiceIsANoOp() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		createClub("chess-club", "Chess Club");

		follow(user, "chess-club");
		follow(user, "chess-club");

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(1)));
		// The second click must not have counted a second follower.
		assertThat(followersOf("chess-club")).isEqualTo(1);
	}

	@Test
	void unfollowingRemovesTheClubAndItsCount() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		createClub("chess-club", "Chess Club");
		createClub("art-society", "Art Society");

		follow(user, "chess-club");
		follow(user, "art-society");
		unfollow(user, "chess-club");

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id", is("art-society")));
		assertThat(followersOf("chess-club")).isZero();
		assertThat(followersOf("art-society")).isEqualTo(1);
	}

	@Test
	void unfollowingSomethingNotFollowedIsHarmless() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		createClub("chess-club", "Chess Club");

		// Never followed, and seeded at zero — the count must not go negative.
		unfollow(user, "chess-club");

		assertThat(followersOf("chess-club")).isZero();
		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(user)))
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void followingAnUnknownClubIs404() throws Exception {
		User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(post("/api/v1/users/me/followed-clubs")
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("clubId", "no-such-club"))))
				.andExpect(status().isNotFound());
	}

	@Test
	void oneUsersFollowsAreInvisibleToAnother() throws Exception {
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		User ben = createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);
		createClub("chess-club", "Chess Club");

		follow(uma, "chess-club");

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(ben)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));

		// Ben unfollowing must not undo Uma's follow — the path has no user in it,
		// so this is the test that the JWT is what scopes the write.
		unfollow(ben, "chess-club");

		mockMvc.perform(get("/api/v1/users/me/clubs").header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$", hasSize(1)));
		assertThat(followersOf("chess-club")).isEqualTo(1);
	}
}
