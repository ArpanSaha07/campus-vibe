package com.campusvibe.user.profile;

import com.campusvibe.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
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
	void everyEntryCarriesASlugALabelAndACategory() throws Exception {
		mockMvc.perform(get(PATH))
				.andExpect(status().isOk())
				// V20 seeds this first, so it also pins the ordering: the
				// endpoint returns catalogue order, which is why sortOrder does
				// not need to cross the wire.
				.andExpect(jsonPath("$[0].slug", is("study-groups")))
				.andExpect(jsonPath("$[0].label", is("Study groups")))
				.andExpect(jsonPath("$[0].category", is("Academic & career")));
	}

	@Test
	void theCatalogueSurvivesTheTestReset() throws Exception {
		// AbstractIntegrationTest deliberately does not truncate this table.
		// It is Flyway reference data, not per-test state, and clearing it
		// between tests would leave every later interest write failing its
		// foreign key for no reason anyone could see.
		mockMvc.perform(get(PATH))
				.andExpect(jsonPath("$", hasSize(76)));
	}
}
