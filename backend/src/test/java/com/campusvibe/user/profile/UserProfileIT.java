package com.campusvibe.user.profile;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserProfileIT extends AbstractIntegrationTest {

	private static final String PATH = "/api/v1/users/me/profile";

	/**
	 * A complete body with nothing filled in.
	 *
	 * <p>Built as a mutable map rather than {@code Map.of} because every field
	 * here is allowed to be null and {@code Map.of} refuses nulls — which is the
	 * case most worth testing.
	 */
	private Map<String, Object> body() {
		Map<String, Object> profile = new LinkedHashMap<>();
		profile.put("bio", null);
		profile.put("faculty", null);
		profile.put("degree", null);
		profile.put("subjects", List.of());
		profile.put("socialLinks", links(null, null, null));
		profile.put("interests", List.of());
		profile.put("showInterests", true);
		profile.put("showSocialLinks", true);
		return profile;
	}

	private Map<String, Object> links(String instagram, String facebook, String linkedin) {
		Map<String, Object> links = new HashMap<>();
		links.put("instagram", instagram);
		links.put("facebook", facebook);
		links.put("linkedin", linkedin);
		return links;
	}

	private void save(User user, Map<String, Object> profile, int expectedStatus) throws Exception {
		mockMvc.perform(put(PATH)
						.header("Authorization", bearer(user))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(profile)))
				.andExpect(status().is(expectedStatus));
	}

	private User someone(String name, String email) {
		return createUser(name, email, "password123", RoleName.ROLE_USER);
	}

	@Test
	void readingAProfileRequiresAuthentication() throws Exception {
		// 403, not 401: DelegatedAuthEntryPoint hands AuthenticationException to
		// DefaultExceptionHandler, which answers 403 app-wide. Same expectation
		// as MyEventsIT and MyClubsIT.
		mockMvc.perform(get(PATH)).andExpect(status().isForbidden());
	}

	@Test
	void writingAProfileRequiresAuthentication() throws Exception {
		mockMvc.perform(put(PATH)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body())))
				.andExpect(status().isForbidden());
	}

	@Test
	void anAccountWithNoProfileGetsACompleteEmptyOne() throws Exception {
		// Not a 404. Every account that predates this table is in exactly this
		// state, and the editor needs every field present to bind its inputs to.
		User uma = someone("Uma", "uma@campus.com");

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bio", is(nullValue())))
				.andExpect(jsonPath("$.faculty", is(nullValue())))
				.andExpect(jsonPath("$.degree", is(nullValue())))
				.andExpect(jsonPath("$.subjects", hasSize(0)))
				.andExpect(jsonPath("$.interests", hasSize(0)))
				.andExpect(jsonPath("$.socialLinks.instagram", is(nullValue())))
				.andExpect(jsonPath("$.showInterests", is(true)))
				.andExpect(jsonPath("$.showSocialLinks", is(true)));
	}

	@Test
	void whatIsSavedIsWhatComesBack() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("bio", "Second year, mostly in the library.");
		profile.put("faculty", "Faculty of Engineering");
		profile.put("degree", "Master of Software Engineering");
		profile.put("subjects", List.of("Software Design", "Algorithms"));
		profile.put("interests", List.of("chess", "hiking"));
		profile.put("showSocialLinks", false);
		save(uma, profile, 200);

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bio", is("Second year, mostly in the library.")))
				.andExpect(jsonPath("$.faculty", is("Faculty of Engineering")))
				.andExpect(jsonPath("$.degree", is("Master of Software Engineering")))
				// Both collections come back sorted, so two reads of one row
				// cannot disagree about the order.
				.andExpect(jsonPath("$.subjects", contains("Algorithms", "Software Design")))
				.andExpect(jsonPath("$.interests", contains("chess", "hiking")))
				.andExpect(jsonPath("$.showSocialLinks", is(false)));
	}

	@Test
	void savingReplacesEverythingRatherThanMerging() throws Exception {
		// The endpoint is a PUT and means it. This is the behaviour that the
		// shared ProfileProvider on the frontend exists to make safe: if a
		// settings section built its draft from an empty profile instead of the
		// loaded one, saving it would erase every field that section does not
		// show.
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> full = body();
		full.put("bio", "Here first.");
		full.put("degree", "Master of Software Engineering");
		full.put("interests", List.of("chess"));
		save(uma, full, 200);

		save(uma, body(), 200);

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.bio", is(nullValue())))
				.andExpect(jsonPath("$.degree", is(nullValue())))
				.andExpect(jsonPath("$.interests", hasSize(0)));
	}

	@Test
	void oneUsersProfileIsInvisibleToAnother() throws Exception {
		User uma = someone("Uma", "uma@campus.com");
		User ben = someone("Ben", "ben@campus.com");

		Map<String, Object> profile = body();
		profile.put("bio", "Written by Uma.");
		save(uma, profile, 200);

		// There is no path variable to tamper with — the acting user comes off
		// the token — so Ben asking for "my profile" can only ever get his own.
		mockMvc.perform(get(PATH).header("Authorization", bearer(ben)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.bio", is(nullValue())));
	}

	@Test
	void aHostileSchemeIsRefusedByTheServerAndNotJustTheBrowser() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("socialLinks", links("javascript:alert(1)", null, null));

		save(uma, profile, 400);

		// And nothing was written on the way past.
		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.socialLinks.instagram", is(nullValue())));
	}

	@Test
	void aBareHandleIsStoredAsAnHttpsUrl() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("socialLinks", links("instagram.com/uma", null, null));
		save(uma, profile, 200);

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.socialLinks.instagram", is("https://instagram.com/uma")));
	}

	@Test
	void anInterestOutsideTheCatalogueIsRefused() throws Exception {
		// A 400 naming the slug, rather than the foreign key surfacing as a 500.
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("interests", List.of("chess", "competitive-napping"));

		mockMvc.perform(put(PATH)
						.header("Authorization", bearer(uma))
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(profile)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message", containsString("competitive-napping")));
	}

	@Test
	void aBlankBioIsStoredAsNothingRatherThanAnEmptyString() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("bio", "   ");
		save(uma, profile, 200);

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.bio", is(nullValue())));
	}

	@Test
	void aBioLongerThanTheEditorAllowsIsRefused() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("bio", "x".repeat(501));

		save(uma, profile, 400);
	}

	@Test
	void moreSubjectsThanThePickerAllowsAreRefused() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("subjects", IntStream.rangeClosed(1, 13)
				.mapToObj(n -> "Subject " + n)
				.toList());

		save(uma, profile, 400);
	}

	@Test
	void subjectsRepeatedInDifferentCasingAreOneSubject() throws Exception {
		User uma = someone("Uma", "uma@campus.com");

		Map<String, Object> profile = body();
		profile.put("subjects", List.of("Algorithms", "algorithms", "ALGORITHMS"));
		save(uma, profile, 200);

		mockMvc.perform(get(PATH).header("Authorization", bearer(uma)))
				.andExpect(jsonPath("$.subjects", hasSize(1)))
				.andExpect(jsonPath("$.subjects", contains("Algorithms")));
	}
}
