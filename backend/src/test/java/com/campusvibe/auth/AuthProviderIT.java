package com.campusvibe.auth;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.AuthProvider;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The V10 provider split: a Google account is distinguishable from a password
 * account, has no password, and cannot be signed into with one — plus the
 * signup-time collision check that tells a Google user to use Google.
 *
 * <p>Also covers the two Google-endpoint defects that survived because
 * {@code AuthenticationFlowIT} never touched that endpoint (BUG-028, BUG-029).
 */
class AuthProviderIT extends AbstractIntegrationTest {

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    // --- the schema itself ------------------------------------------------

    @Test
    void googleAccountHasNoPasswordAndIsLabelledGoogle() {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        User stored = userRepository.findByEmail("gina@campus.com").orElseThrow();
        assertEquals(AuthProvider.GOOGLE, stored.getAuthProvider());
        assertNull(stored.getPassword(), "a Google account must not carry a password hash");
    }

    @Test
    void registeredAccountIsLabelledLocalAndKeepsItsHash() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Liam",
                                "email", "liam@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());

        User stored = userRepository.findByEmail("liam@campus.com").orElseThrow();
        assertEquals(AuthProvider.LOCAL, stored.getAuthProvider());
        assertEquals(true, passwordEncoder.matches("password123", stored.getPassword()));
    }

    // --- email-status: the signup-time collision check ---------------------

    @Test
    void emailStatusReportsAnUnknownAddressAsFree() throws Exception {
        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists", is(false)))
                .andExpect(jsonPath("$.provider", nullValue()));
    }

    @Test
    void emailStatusNamesGoogleAsTheOwner() throws Exception {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "gina@campus.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists", is(true)))
                .andExpect(jsonPath("$.provider", is("GOOGLE")));
    }

    @Test
    void emailStatusNamesLocalAsTheOwner() throws Exception {
        createUser("Liam", "liam@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "liam@campus.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists", is(true)))
                .andExpect(jsonPath("$.provider", is("LOCAL")));
    }

    @Test
    void emailStatusIsCaseInsensitive() throws Exception {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "GINA@Campus.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists", is(true)))
                .andExpect(jsonPath("$.provider", is("GOOGLE")));
    }

    @Test
    void emailStatusRejectsAMalformedAddress() throws Exception {
        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "not-an-email"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void emailStatusIsReachableWithoutSigningIn() throws Exception {
        // The signup form asks before anyone is authenticated; a 401 here would
        // make the whole feature silently do nothing.
        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                .andExpect(status().isOk());
    }

    // --- registering over a Google account ---------------------------------

    @Test
    void registeringOverAGoogleAccountSaysToUseGoogle() throws Exception {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Gina Again",
                                "email", "gina@campus.com",
                                "password", "password123"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("Google")));
    }

    @Test
    void registeringOverALocalAccountKeepsTheGenericMessage() throws Exception {
        createUser("Liam", "liam@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Liam Again",
                                "email", "liam@campus.com",
                                "password", "password123"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", not(containsStringIgnoringCase("Google"))));
    }

    @Test
    void registeringWithADifferentCaseIsStillADuplicate() throws Exception {
        createUser("Liam", "liam@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Liam Again",
                                "email", "LIAM@Campus.COM",
                                "password", "password123"))))
                .andExpect(status().isConflict());
    }

    @Test
    void registerStoresTheEmailLowercased() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Mixed",
                                "email", "MiXeD@Campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email", is("mixed@campus.com")));
    }

    // --- logging in to a Google account with a password --------------------

    @Test
    void passwordLoginAgainstAGoogleAccountIsRejectedNotCrashed() throws Exception {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        // The account's password column is NULL. Before the guard in
        // EmailPasswordAuthenticationProvider this reached
        // passwordEncoder.matches(raw, null).
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "gina@campus.com",
                                "password", "anything-at-all"))))
                .andExpect(status().isUnauthorized())
                // Identical to a wrong password: login must not become a way to
                // ask which provider owns an address.
                .andExpect(jsonPath("$.message", is("Invalid credentials")));
    }

    @Test
    void passwordLoginIsCaseInsensitiveOnEmail() throws Exception {
        createUser("Liam", "liam@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", "LIAM@Campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());
    }

    // --- the Google endpoint (BUG-028, BUG-029) ----------------------------

    @Test
    void malformedGoogleTokenIsRejectedWith401NotServerError() throws Exception {
        // No dots, so Google's parser throws IllegalArgumentException before
        // verification ever runs. That used to escape as a 500 with a null body.
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("idToken", "not-a-real-token"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void structurallyValidButUnsignedGoogleTokenIsRejectedWith401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("idToken", "aaa.bbb.ccc"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void missingGoogleTokenIsA400NotA500() throws Exception {
        // Was a 500 echoing 'Cannot invoke "String.indexOf(int)" because
        // "tokenString" is null' straight to the caller.
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void blankGoogleTokenIsA400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("idToken", "   "))))
                .andExpect(status().isBadRequest());
    }
}
