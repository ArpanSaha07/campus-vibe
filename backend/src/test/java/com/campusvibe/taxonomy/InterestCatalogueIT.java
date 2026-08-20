package com.campusvibe.taxonomy;

import com.campusvibe.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The interest vocabulary, as served to the picker.
 *
 * <p>An {@code *IT} rather than a {@code *Test} because the rows come from V20
 * and only the integration profile runs Flyway — the H2 suites build their
 * schema from the entities and would find the table empty.
 */
class InterestCatalogueIT extends AbstractIntegrationTest {

	private static final String PATH = "/api/v1/interests";

	@Test
	void theCatalogueIsPublic() throws Exception {
		// No token. It names nobody, is identical for everyone, and a public
		// profile will have to render the labels behind someone's interests
		// with nothing to authenticate as.
		mockMvc.perform(get(PATH))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(greaterThan(0))));
	}

	@Test
	void theResponseCarriesBothLevels() throws Exception {
		// V26 promoted the twelve groups from a text column to rows of their
		// own, so an event can be tagged with one. They come through with a
		// null parentSlug; an interest names the group it hangs under.
		mockMvc.perform(get(PATH))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.slug == 'academic-career')].parentSlug",
						contains(nullValue())))
				.andExpect(jsonPath("$[?(@.slug == 'study-groups')].parentSlug",
						contains("academic-career")))
				.andExpect(jsonPath("$[?(@.slug == 'study-groups')].label",
						contains("Study groups")));
	}

	@Test
	void theGroupsAreTaggableRowsRatherThanAStringColumn() throws Exception {
		// Twelve of them, and every one reachable by slug. This is what makes
		// event_topic_assignments a single foreign key rather than two nullable
		// columns and a CHECK.
		mockMvc.perform(get(PATH))
				.andExpect(jsonPath("$[?(@.parentSlug == null)]", hasSize(12)));
	}

	@Test
	void techWasRelabelledWithoutMovingItsSlug() throws Exception {
		// V27 renamed the label because `Tech` was an informal heading when it
		// only ever headed a picker section, and is now something an event is
		// tagged with. The slug is untouched, which is the point of keying on
		// slugs rather than labels.
		mockMvc.perform(get(PATH))
				.andExpect(jsonPath("$[?(@.slug == 'tech')].label", contains("Technology")));
	}

	@Test
	void theCatalogueSurvivesTheTestReset() throws Exception {
		// AbstractIntegrationTest deliberately does not truncate this table.
		// It is Flyway reference data, not per-test state, and clearing it
		// between tests would leave every later interest write failing its
		// foreign key for no reason anyone could see.
		//
		// 104 = the 76 of V20, plus V26's twelve groups, plus the sixteen V27
		// added to cover topics the event vocabulary needed and the catalogue
		// could not express.
		mockMvc.perform(get(PATH))
				.andExpect(jsonPath("$", hasSize(104)));
	}
}
