package com.campusvibe.user;

import com.campusvibe.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Editing the account itself, as opposed to the profile hanging off it.
 *
 * <p>Only the display name today. The email address is deliberately not
 * editable: it is the login identifier, so changing it without proving control
 * of the new inbox would lock the account out.
 */
class MyAccountIT extends AbstractIntegrationTest {

	private static final String PATH = "/api/v1/users/me";

	private String json(Object body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	@Test
	void renamingRequiresAuthentication() throws Exception {
		mockMvc.perform(patch(PATH)
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("name", "Someone Else"))))
				.andExpect(status().isForbidden());
	}

	@Test
	void theNewNameComesBackAndIsStored() throws Exception {
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		// Answered with the updated account so the caller can put it straight
		// into its auth state; otherwise the navbar keeps the old name until
		// something else happens to refetch.
		mockMvc.perform(patch(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("name", "Uma Thorne"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name", is("Uma Thorne")))
				.andExpect(jsonPath("$.email", is("uma@campus.com")));

		assertThat(userRepository.findById(uma.getId()).orElseThrow().getName())
				.isEqualTo("Uma Thorne");
	}

	@Test
	void surroundingSpaceIsTrimmedRatherThanStored() throws Exception {
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(patch(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("name", "  Uma Thorne  "))))
				.andExpect(jsonPath("$.name", is("Uma Thorne")));
	}

	@Test
	void aBlankNameIsRefused() throws Exception {
		// An account with no name would render as an empty avatar and an empty
		// byline everywhere it appears.
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(patch(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("name", "   "))))
				.andExpect(status().isBadRequest());

		assertThat(userRepository.findById(uma.getId()).orElseThrow().getName()).isEqualTo("Uma");
	}

	@Test
	void oneUserCannotRenameAnother() throws Exception {
		// There is no id in the path to aim at — the acting account comes off
		// the token — so this can only ever rename the caller.
		User uma = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
		User ben = createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);

		mockMvc.perform(patch(PATH)
						.header("Authorization", bearer(ben))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(Map.of("name", "Ben Renamed"))))
				.andExpect(status().isOk());

		assertThat(userRepository.findById(uma.getId()).orElseThrow().getName()).isEqualTo("Uma");
	}
}
