package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.auth.RecordingMailSender;
import com.campusvibe.club.Club;
import com.campusvibe.mail.MailSender;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The confirmed-address rule on club invitations, switched on.
 *
 * <p>Off by default and everywhere else, because confirmation mail is not
 * reliably delivered yet and the rule was refusing real invitees, so this is the
 * only place its behaviour is pinned — the twin of {@code RequireVerifiedEmailIT}
 * for the sign-in gate.
 *
 * <p>The attack it closes: sign-up does not require confirming the address, so
 * without the rule anyone who registered the incoming treasurer's address first
 * would inherit the invitation sent to it. That is what is being given up while
 * the switch is off, and what turning it back on restores.
 */
@TestPropertySource(properties = "campusvibe.auth.require-verified-email-for-invitations=true")
@Import(InvitationRequiresVerifiedEmailIT.MailTestConfig.class)
class InvitationRequiresVerifiedEmailIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class MailTestConfig {
        @Bean
        @Primary
        MailSender recordingMailSender() {
            return new RecordingMailSender();
        }
    }

    private Long inviteAndReturnId(Club club, User owner, String email) throws Exception {
        String response = mockMvc.perform(post("/api/v1/clubs/%s/admins/invitations".formatted(club.getId()))
                        .header("Authorization", bearer(owner))
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("assignmentId").asLong();
    }

    private User createConfirmedUser(String name, String email) {
        User user = createUser(name, email, "password123", RoleName.ROLE_USER);
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    @Test
    void anUnconfirmedAccountCannotClaimAnInvitationToItsAddress() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        // Registered the address but never followed the confirmation link.
        User squatter = createUser("Squatter", "emma@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(squatter)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("Confirm your email address")));

        assertEquals(AssignmentStatus.PENDING,
                clubAdminAssignmentRepository.findById(invitationId).orElseThrow().getStatus());
    }

    /**
     * Declining is held to the same rule deliberately: letting an unconfirmed
     * account decline would be a quiet way to keep a rival off a club's team.
     */
    @Test
    void anUnconfirmedAccountCannotDeclineEither() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        User squatter = createUser("Squatter", "emma@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/decline".formatted(invitationId))
                        .header("Authorization", bearer(squatter)))
                .andExpect(status().isForbidden());

        assertEquals(AssignmentStatus.PENDING,
                clubAdminAssignmentRepository.findById(invitationId).orElseThrow().getStatus());
    }

    /** A confirmed account is unaffected: the switch gates nothing else. */
    @Test
    void aConfirmedAccountStillAccepts() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk());

        assertEquals(AssignmentStatus.ACTIVE,
                clubAdminAssignmentRepository.findById(invitationId).orElseThrow().getStatus());
    }
}
