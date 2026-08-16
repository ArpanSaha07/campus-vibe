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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Email verification: sent on register, redeemed by link, resent on request. */
@Import(EmailVerificationIT.MailTestConfig.class)
class EmailVerificationIT extends AbstractIntegrationTest {

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

    private String registerAnn() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());
        return mail().lastTokenTo("ann@campus.com")
                .orElseThrow(() -> new AssertionError("register sent no verification link"));
    }

    // --- issuing -----------------------------------------------------------

    @Test
    void registerSendsAConfirmationLinkAndStartsUnverified() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified", is(false)));

        var message = mail().lastTo("ann@campus.com").orElseThrow();
        assertTrue(message.body().contains("/?auth=verify-email&token="),
                "link must open the frontend, was:\n" + message.body());
    }

    @Test
    void aGoogleAccountIsVerifiedOnCreationAndGetsNoMail() throws Exception {
        // googleSignIn refuses a token whose email_verified claim is not set, so
        // the address is already proven by the time the row is written.
        createGoogleUser("Gina", "gina@campus.com", RoleName.ROLE_USER);

        User stored = userRepository.findByEmail("gina@campus.com").orElseThrow();
        assertFalse(stored.isEmailVerified(),
                "helper writes the row directly; googleSignIn is what sets the flag");
        assertTrue(mail().sent().isEmpty());
    }

    // --- redeeming ---------------------------------------------------------

    @Test
    void theLinkConfirmsTheAddress() throws Exception {
        String token = registerAnn();

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified", is(true)));
    }

    @Test
    void aVerificationTokenCannotBeUsedTwice() throws Exception {
        String token = registerAnn();

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anUnknownTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", "nonsense"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aResetTokenCannotBeUsedToVerifyAnAddress() throws Exception {
        createUser("Bob", "bob@campus.com", "password123", RoleName.ROLE_USER);
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "bob@campus.com"))))
                .andExpect(status().isNoContent());
        String resetToken = mail().lastTokenTo("bob@campus.com").orElseThrow();

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", resetToken))))
                .andExpect(status().isUnauthorized());
    }

    // --- resending ---------------------------------------------------------

    @Test
    void resendRequiresASession() throws Exception {
        // Otherwise it is a way to mail a stranger repeatedly.
        mockMvc.perform(post("/api/v1/auth/resend-verification"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void resendMailsAFreshLinkThatWorks() throws Exception {
        String first = registerAnn();
        User ann = userRepository.findByEmail("ann@campus.com").orElseThrow();
        mail().clear();

        mockMvc.perform(post("/api/v1/auth/resend-verification")
                        .header("Authorization", bearer(ann)))
                .andExpect(status().isNoContent());

        String second = mail().lastTokenTo("ann@campus.com").orElseThrow();
        assertNotEquals(first, second);

        // The superseded link must be dead, or resending multiplies the number
        // of live credentials instead of replacing one.
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", first))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", second))))
                .andExpect(status().isNoContent());
    }

    @Test
    void resendIsANoOpOnceVerified() throws Exception {
        String token = registerAnn();
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token))))
                .andExpect(status().isNoContent());

        User ann = userRepository.findByEmail("ann@campus.com").orElseThrow();
        mail().clear();

        mockMvc.perform(post("/api/v1/auth/resend-verification")
                        .header("Authorization", bearer(ann)))
                .andExpect(status().isNoContent());

        assertTrue(mail().sent().isEmpty(), "a verified account needs no further mail");
    }

    // --- the gate, which is off by default ---------------------------------

    @Test
    void anUnverifiedUserCanStillSignInWhileTheGateIsOff() throws Exception {
        registerAnn();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "password123"))))
                .andExpect(status().isOk());
    }

    @Test
    void theCurrentUserReportsItsVerificationStateAndProvider() throws Exception {
        registerAnn();
        User ann = userRepository.findByEmail("ann@campus.com").orElseThrow();

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", bearer(ann)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified", is(false)))
                .andExpect(jsonPath("$.authProvider", is("LOCAL")));
    }
}
