package com.campusvibe.auth;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.mail.MailSender;
import com.campusvibe.user.RoleName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The verification gate, switched on. Off everywhere else, so this is the only
 * place its behaviour is pinned.
 */
@TestPropertySource(properties = "campusvibe.auth.require-verified-email=true")
@Import(RequireVerifiedEmailIT.MailTestConfig.class)
class RequireVerifiedEmailIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class MailTestConfig {
        @Bean
        @Primary
        MailSender recordingMailSender() {
            return new RecordingMailSender();
        }
    }

    @Autowired private MailSender mailSender;

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    @Test
    void anUnverifiedAccountIsRefusedWith403NotWith401() throws Exception {
        ((RecordingMailSender) mailSender).clear();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());

        // 403, not 401: the password was right. Answering 401 would tell the
        // user their password is wrong and leave them retrying it forever.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "password123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsStringIgnoringCase("confirm")));
    }

    @Test
    void confirmingTheAddressUnblocksSignIn() throws Exception {
        RecordingMailSender mail = (RecordingMailSender) mailSender;
        mail.clear();
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Ann", "email", "ann@campus.com",
                                "password", "password123"))))
                .andExpect(status().isOk());

        String token = mail.lastTokenTo("ann@campus.com").orElseThrow();
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", token))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "password123"))))
                .andExpect(status().isOk());
    }

    @Test
    void aWrongPasswordIsStill401NotTheVerificationMessage() throws Exception {
        createUser("Bob", "bob@campus.com", "password123", RoleName.ROLE_USER);

        // The gate must run after authentication, never instead of it —
        // otherwise it would confirm an address exists to someone who has not
        // proven they hold the credentials.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "bob@campus.com", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());
    }
}
