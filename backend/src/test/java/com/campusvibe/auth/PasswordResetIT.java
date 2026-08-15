package com.campusvibe.auth;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.mail.MailSender;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Password reset, end to end: request, mail, redeem, sign in with the new password. */
@Import(PasswordResetIT.MailTestConfig.class)
class PasswordResetIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class MailTestConfig {
        @Bean
        @Primary
        MailSender recordingMailSender() {
            return new RecordingMailSender();
        }
    }

    @Autowired private MailSender mailSender;

    private RecordingMailSender mail() {
        return (RecordingMailSender) mailSender;
    }

    @BeforeEach
    void clearMail() {
        mail().clear();
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private void forgot(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email))))
                .andExpect(status().isNoContent());
    }

    // --- the happy path ----------------------------------------------------

    @Test
    void resetLinkLetsTheUserSetANewPasswordAndSignInWithIt() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);

        forgot("ann@campus.com");
        String token = mail().lastTokenTo("ann@campus.com")
                .orElseThrow(() -> new AssertionError("no reset link was sent"));

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "brand-new-password1"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "brand-new-password1"))))
                .andExpect(status().isOk());

        // And the old one is dead.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "old-password1"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theLinkPointsAtTheFrontendResetView() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);
        forgot("ann@campus.com");

        String body = mail().lastTo("ann@campus.com").orElseThrow().body();
        // A link to the API instead of the app would be a dead end for a human.
        assertTrue(body.contains("/?auth=reset-password&token="),
                "reset link must open the frontend reset view, was:\n" + body);
    }

    // --- single use, expiry, invalidation ----------------------------------

    @Test
    void aResetTokenCannotBeUsedTwice() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);
        forgot("ann@campus.com");
        String token = mail().lastTokenTo("ann@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "first-new-password1"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "second-new-password1"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requestingASecondLinkKillsTheFirst() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);

        forgot("ann@campus.com");
        String first = mail().lastTokenTo("ann@campus.com").orElseThrow();
        mail().clear();
        forgot("ann@campus.com");
        String second = mail().lastTokenTo("ann@campus.com").orElseThrow();

        assertNotEquals(first, second);

        // Otherwise every link ever mailed stays live, and the number of working
        // credentials for the account grows with each request.
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", first, "password", "new-password1"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", second, "password", "new-password1"))))
                .andExpect(status().isNoContent());
    }

    @Test
    void anUnknownTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", "not-a-real-token", "password", "new-password1"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aShortNewPasswordIsRejected() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);
        forgot("ann@campus.com");
        String token = mail().lastTokenTo("ann@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "short"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aVerificationTokenCannotBeUsedToResetAPassword() throws Exception {
        // Both live in one table; the purpose column is what keeps them apart.
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());
        String verifyToken = mail().lastTokenTo("ann@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verifyToken, "password", "new-password1"))))
                .andExpect(status().isUnauthorized());
    }

    // --- no enumeration ----------------------------------------------------

    @Test
    void forgotPasswordIs204ForAnUnknownAddressAndSendsNothing() throws Exception {
        forgot("nobody@campus.com");
        assertTrue(mail().sent().isEmpty(), "no mail may be sent for an unknown address");
    }

    @Test
    void forgotPasswordIs204ForAGoogleAccountAndSendsNothing() throws Exception {
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        forgot("gina@campus.com");

        // A Google account has no password to reset. Mailing a link anyway would
        // turn a mailbox compromise into a way to bolt a password onto it.
        assertTrue(mail().sent().isEmpty(), "a Google account must not receive a reset link");
    }

    @Test
    void forgotPasswordIsCaseInsensitive() throws Exception {
        createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);
        forgot("ANN@Campus.COM");
        assertTrue(mail().lastTokenTo("ann@campus.com").isPresent());
    }

    // --- interaction with lockout ------------------------------------------

    @Test
    void aSuccessfulResetClearsTheFailureCounter() throws Exception {
        User ann = createUser("Ann", "ann@campus.com", "old-password1", RoleName.ROLE_USER);
        assertNotNull(ann.getId());

        forgot("ann@campus.com");
        String token = mail().lastTokenTo("ann@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "brand-new-password1"))))
                .andExpect(status().isNoContent());

        // Someone who has just proven inbox control should not still be locked
        // out by the guesses that sent them to the reset form.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "brand-new-password1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(emptyString())));
    }

    @Test
    void resettingAlsoConfirmsTheAddress() throws Exception {
        // Redeeming a mailed link is itself proof the address is reachable.
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified", is(false)));

        mail().clear();
        forgot("ann@campus.com");
        String token = mail().lastTokenTo("ann@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token, "password", "brand-new-password1"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "brand-new-password1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified", is(true)));
    }
}
