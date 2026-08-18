package com.campusvibe.bootstrap;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.AuthProvider;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The admin bootstrap runner — Step 2 of the database-lifecycle plan.
 *
 * <p>The runner is driven directly rather than through a context restart. Its
 * whole contract is "what does one execution do to the database", and calling
 * {@code run} lets a single test execute it twice and assert that the second
 * pass changed nothing — which is the property that actually matters and which
 * a restart-per-case setup cannot express at all.
 *
 * <p>Each case builds its own runner with its own {@link BootstrapProperties},
 * because the configured address is the input under test. The autowired beans
 * are the real repositories and the real password encoder, so what these assert
 * about the resulting rows is what production would produce.
 */
class AdminBootstrapRunnerIT extends AbstractIntegrationTest {

    @Autowired private org.springframework.security.crypto.password.PasswordEncoder encoder;

    private AdminBootstrapRunner runnerFor(boolean enabled, String email, String password) {
        return new AdminBootstrapRunner(
                new BootstrapProperties(enabled, email, password),
                userRepository, roleRepository, encoder);
    }

    private void run(AdminBootstrapRunner runner) {
        runner.run(new DefaultApplicationArguments());
    }

    private boolean isAdmin(String email) {
        return userRepository.findByEmail(email)
                .map(u -> u.hasRole(RoleName.ROLE_ADMIN))
                .orElse(false);
    }

    // --- the path that matters today ----------------------------------------

    @Test
    void promotesAnExistingAccount() {
        createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);

        run(runnerFor(true, "owner@campus.com", ""));

        assertTrue(isAdmin("owner@campus.com"));
    }

    /**
     * The property that a second deploy depends on. {@code user_roles} has
     * {@code (user_id, role_id)} as its primary key, so a duplicate grant would
     * not merely be untidy — it would throw and take the startup with it.
     */
    @Test
    void runningTwiceGrantsOnceAndDoesNotFail() {
        createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);
        AdminBootstrapRunner runner = runnerFor(true, "owner@campus.com", "");

        run(runner);
        assertDoesNotThrow(() -> run(runner));

        User user = userRepository.findByEmail("owner@campus.com").orElseThrow();
        long adminGrants = user.getRoles().stream()
                .filter(r -> r.getName().equals(RoleName.ROLE_ADMIN.name()))
                .count();
        assertEquals(1, adminGrants);
        // And the account keeps everything it already had.
        assertTrue(user.hasRole(RoleName.ROLE_USER));
    }

    /** A Google account has no password, which is exactly why promote is the primary mode. */
    @Test
    void promotesAGoogleAccount() {
        createGoogleUser("Arpan", "google@campus.com", RoleName.ROLE_USER);

        run(runnerFor(true, "google@campus.com", ""));

        User user = userRepository.findByEmail("google@campus.com").orElseThrow();
        assertTrue(user.hasRole(RoleName.ROLE_ADMIN));
        assertEquals(AuthProvider.GOOGLE, user.getAuthProvider());
        assertNull(user.getPassword(), "promotion must not invent a password");
    }

    /** Addresses are matched case-insensitively everywhere else, so also here. */
    @Test
    void matchesTheAddressWithoutRegardToCaseOrPadding() {
        createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);

        run(runnerFor(true, "  Owner@Campus.com  ", ""));

        assertTrue(isAdmin("owner@campus.com"));
    }

    // --- the create path ----------------------------------------------------

    @Test
    void createsTheAccountWhenItDoesNotExistAndAPasswordIsGiven() {
        run(runnerFor(true, "fresh@campus.com", "bootstrap-password"));

        User created = userRepository.findByEmail("fresh@campus.com").orElseThrow();
        assertTrue(created.hasRole(RoleName.ROLE_ADMIN));
        assertTrue(created.hasRole(RoleName.ROLE_USER), "an admin is still a user");
        assertEquals(AuthProvider.LOCAL, created.getAuthProvider());
        assertTrue(created.isEmailVerified());
        // Hashed with the real encoder, so the account can actually sign in.
        assertTrue(encoder.matches("bootstrap-password", created.getPassword()));
        assertNotEquals("bootstrap-password", created.getPassword());
    }

    /**
     * §Admin Bootstrap Rules: never create a password-less account. Such a row
     * could not sign in, but a later password-reset request against the address
     * could claim it.
     */
    @Test
    void refusesToCreateAnAccountWithNoPassword() {
        run(runnerFor(true, "nobody@campus.com", ""));

        assertTrue(userRepository.findByEmail("nobody@campus.com").isEmpty());
    }

    /** A misconfiguration must not take a working application down. */
    @Test
    void aMissingAccountDoesNotFailTheStartup() {
        assertDoesNotThrow(() -> run(runnerFor(true, "nobody@campus.com", "")));
    }

    // --- staying out of the way ---------------------------------------------

    @Test
    void doesNothingWhenDisabled() {
        createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);

        run(runnerFor(false, "owner@campus.com", ""));

        assertFalse(isAdmin("owner@campus.com"));
    }

    @Test
    void doesNothingWhenNoAddressIsConfigured() {
        createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);

        run(runnerFor(true, "", ""));
        run(runnerFor(true, null, ""));

        assertFalse(isAdmin("owner@campus.com"));
    }

    /**
     * Grants only, never revokes. Turning the switch off, or pointing it at a
     * different address, must not quietly strip an administrator on the next
     * deploy — that would make one edited environment variable enough to lock
     * everybody out of production.
     */
    @Test
    void neverRevokesFromAnAccountItNoLongerNames() {
        createUser("First", "first@campus.com", "password123", RoleName.ROLE_USER);
        createUser("Second", "second@campus.com", "password123", RoleName.ROLE_USER);

        run(runnerFor(true, "first@campus.com", ""));
        assertTrue(isAdmin("first@campus.com"));

        // Pointed elsewhere, then switched off entirely.
        run(runnerFor(true, "second@campus.com", ""));
        run(runnerFor(false, "first@campus.com", ""));

        assertTrue(isAdmin("first@campus.com"), "the first admin must keep the role");
        assertTrue(isAdmin("second@campus.com"));
    }

    /**
     * The point of the whole exercise: an admin-only endpoint that answered 403
     * to everyone now answers to somebody. {@code /search/reindex} is the
     * cheapest one to ask.
     */
    @Test
    void theBootstrappedAccountCanReachAnAdminOnlyEndpoint() throws Exception {
        User user = createUser("Arpan", "owner@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/search/reindex")
                        .header("Authorization", bearer(user)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .status().isForbidden());

        run(runnerFor(true, "owner@campus.com", ""));

        // A fresh token, because roles are copied into the JWT when it is
        // issued -- the existing one predates the grant and does not carry it.
        User elevated = userRepository.findByEmail("owner@campus.com").orElseThrow();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/search/reindex")
                        .header("Authorization", bearer(elevated)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .status().is2xxSuccessful());
    }
}
