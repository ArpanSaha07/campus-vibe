package com.campusvibe.user.profile;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationPreferencesIT extends AbstractIntegrationTest {

	private static final String PATH = "/api/v1/users/me/notification-preferences";

	private Map<String, Object> allOff() {
		Map<String, Object> preferences = new LinkedHashMap<>();
		preferences.put("eventReminders", false);
		preferences.put("clubAnnouncements", false);
		preferences.put("weeklyDigest", false);
		preferences.put("newFollowerEvents", false);
		preferences.put("productNews", false);
		return preferences;
	}

	private User someone(String name, String email) {
		return createUser(name, email, "password123", RoleName.ROLE_USER);
	}

	@Test
	void preferencesRequireAuthentication() throws Exception {
		mockMvc.perform(get(PATH)).andExpect(status().isForbidden());
	}

	@Test
	void someoneWhoHasNeverChosenGetsTheDefaults() throws Exception {
		// No row is written on read, so these come from the entity's field
		// initialisers. They must agree with V21's column defaults and with the
		// editor's, or a switch would visibly flip on load.
		User uma = someone("Uma", "uma@campus.com");

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.eventReminders", is(true)))
				.andExpect(jsonPath("$.clubAnnouncements", is(true)))
				.andExpect(jsonPath("$.weeklyDigest", is(true)))
				.andExpect(jsonPath("$.newFollowerEvents", is(true)))
				// The one that starts off: marketing nobody asked for.
				.andExpect(jsonPath("$.productNews", is(false)));
	}

	@Test
	void everySwitchCanBeTurnedOffAndStaysOff() throws Exception {
		// Including the digest. A preference screen where one row cannot
		// actually be turned off is worse than not offering it.
		User uma = someone("Uma", "uma@campus.com");

		mockMvc.perform(put(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(allOff())))
				.andExpect(status().isOk());

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.eventReminders", is(false)))
				.andExpect(jsonPath("$.clubAnnouncements", is(false)))
				.andExpect(jsonPath("$.weeklyDigest", is(false)))
				.andExpect(jsonPath("$.newFollowerEvents", is(false)))
				.andExpect(jsonPath("$.productNews", is(false)));
	}

	@Test
	void oneUsersPreferencesDoNotAffectAnother() throws Exception {
		User uma = someone("Uma", "uma@campus.com");
		User ben = someone("Ben", "ben@campus.com");

		mockMvc.perform(put(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(allOff())))
				.andExpect(status().isOk());

		mockMvc.perform(get(PATH).header("Authorization", bearer(ben)))
				.andExpect(jsonPath("$.eventReminders", is(true)));
	}
}
