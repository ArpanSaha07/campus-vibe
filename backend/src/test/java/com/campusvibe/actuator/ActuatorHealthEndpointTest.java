package com.campusvibe.actuator;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guards the readiness contract that the whole pipeline hangs off.
 *
 * <p>Two CI jobs — Database / Apply migrations to a clean database, and
 * Docker / Wait for the backend — poll {@code /actuator/health} and wait for
 * {@code UP}. So would any deployment platform. All of them break at once if
 * {@code spring-boot-starter-actuator} is dropped from the pom, if the
 * {@code management.endpoints.web.exposure.include} list stops naming
 * {@code health}, or if the {@code /actuator/**} permit disappears from
 * SecurityFilterChainConfig.
 *
 * <p>None of those produce a compile error. Before this test existed, the only
 * symptom was a CI job timing out after three minutes against a perfectly
 * healthy application — see BUG-015. This is deliberately a {@code *Test} and
 * not a {@code *IT}, so it runs in the fast tier and fails on the push that
 * breaks it rather than on the pull request.
 *
 * <p>The annotations match AbstractIntegrationTest exactly so the Spring
 * TestContext cache reuses one context across both instead of building a
 * second.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActuatorHealthEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointExistsAndReportsUpWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));
    }

    /**
     * The exposure list is a security boundary, not a convenience setting.
     * {@code /actuator/**} is permitAll, so anything added to
     * {@code management.endpoints.web.exposure.include} becomes publicly
     * readable — {@code env} and {@code configprops} would leak configuration
     * including datasource settings. Widening that list must be a deliberate
     * act that breaks a test, not an unnoticed one-word edit.
     */
    @Test
    void endpointsOutsideTheExposureListAreNotServed() throws Exception {
        int status = mockMvc.perform(get("/actuator/env"))
                .andReturn().getResponse().getStatus();

        assertNotEquals(200, status,
                "/actuator/env responded 200. Only health and info may be exposed; "
                        + "check management.endpoints.web.exposure.include.");
    }
}
