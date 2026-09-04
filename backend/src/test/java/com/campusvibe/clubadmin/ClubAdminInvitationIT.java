package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.auth.RecordingMailSender;
import com.campusvibe.club.Club;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Inviting and removing club administrators — MVP items 5 and 7 of the
 * governance doc.
 *
 * <p>Three properties carry most of the weight here and are worth naming, since
 * a future change that quietly breaks one of them would still leave the happy
 * path working:
 *
 * <ol>
 *   <li>A PENDING row grants nothing. Being invited is not being an
 *       administrator (§6).</li>
 *   <li>Claiming an invitation requires a <em>confirmed</em> address. Without
 *       it, registering someone else's address is enough to steal their
 *       invitation, because sign-up does not require confirming one.</li>
 *   <li>Removal takes effect on the next request, not on the next login. That
 *       is the whole reason authority lives in this table rather than in a
 *       token claim (§28).</li>
 * </ol>
 */
@Import(ClubAdminInvitationIT.MailTestConfig.class)
class ClubAdminInvitationIT extends AbstractIntegrationTest {

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

    // --- fixtures -----------------------------------------------------------

    /**
     * A user who has confirmed their address, which is the normal state after
     * following the sign-up link and the only state that can answer an
     * invitation.
     */
    private User createConfirmedUser(String name, String email) {
        User user = createUser(name, email, "password123", RoleName.ROLE_USER);
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private String inviteBody(String email) throws Exception {
        return objectMapper.writeValueAsString(Map.of("email", email));
    }

    private Long inviteAndReturnId(Club club, User owner, String email) throws Exception {
        String response = mockMvc.perform(post("/api/v1/clubs/%s/admins/invitations".formatted(club.getId()))
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("assignmentId").asLong();
    }

    // --- inviting -----------------------------------------------------------

    @Test
    void ownerInvitesSomeoneWhoAlreadyHasAnAccount() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("emma@campus.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.role", is("CLUB_ADMIN")))
                .andExpect(jsonPath("$.invitedEmail", is("emma@campus.com")))
                // Resolved straight away, so the Administrators list can show a
                // person rather than an address.
                .andExpect(jsonPath("$.userId", is(emma.getId().intValue())))
                .andExpect(jsonPath("$.userName", is("Emma")));

        assertTrue(mail().lastTo("emma@campus.com").isPresent(), "the invitee should be emailed");
    }

    @Test
    void ownerInvitesAnAddressWithNoAccount() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("newcomer@campus.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId", nullValue()))
                .andExpect(jsonPath("$.userName", nullValue()))
                .andExpect(jsonPath("$.invitedEmail", is("newcomer@campus.com")));

        // The body has to say *which* address to sign up with, or the invitee
        // creates an account the invitation can never match.
        String body = mail().lastTo("newcomer@campus.com").orElseThrow().body();
        assertTrue(body.contains("newcomer@campus.com"),
                "the sign-up instructions should name the invited address");
    }

    /** §6: an invitation is an offer. Nothing is granted until it is accepted. */
    @Test
    void aPendingInvitationGrantsNothing() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/users/me/managed-clubs")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    /** §37: an admin who is compromised cannot bring in an accomplice. */
    @Test
    void aClubAdminCannotInvite() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, owner);
        makeClubAdmin(club, michael);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(michael))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("accomplice@campus.com")))
                .andExpect(status().isForbidden());
    }

    @Test
    void anOutsiderCannotInvite() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User stranger = createConfirmedUser("Stranger", "stranger@campus.com");
        makeClubOwner(club, owner);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(stranger))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("someone@campus.com")))
                .andExpect(status().isForbidden());
    }

    @Test
    void invitingSomeoneAlreadyOnTheTeamIsRefused() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, owner);
        makeClubAdmin(club, michael);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("michael@campus.com")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already on this club's team")));
    }

    /**
     * Addresses are one mailbox regardless of case, so the second invitation is
     * a duplicate even though the strings differ.
     */
    @Test
    void addressesAreMatchedWithoutRegardToCase() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("Emma@Campus.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invitedEmail", is("emma@campus.com")));

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("emma@campus.com")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already an invitation waiting")));
    }

    @Test
    void malformedAddressesAreRejected() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody("not-an-address")))
                .andExpect(status().isBadRequest());
    }

    // --- accepting ----------------------------------------------------------

    @Test
    void acceptingAnInvitationGrantsAccessImmediately() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clubId", is("robotics")))
                .andExpect(jsonPath("$.role", is("CLUB_ADMIN")));

        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    /**
     * Someone invited before they had an account signs up with that address and
     * the invitation is waiting. This is the whole reason invitations are keyed
     * on an address as well as a user id.
     */
    @Test
    void someoneWhoSignsUpAfterTheInvitationCanStillClaimIt() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "newcomer@campus.com");

        User newcomer = createConfirmedUser("Newcomer", "newcomer@campus.com");

        mockMvc.perform(get("/api/v1/users/me/club-invitations")
                        .header("Authorization", bearer(newcomer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].clubName", is("Robotics")))
                .andExpect(jsonPath("$[0].invitedByName", is("Sarah")));

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(newcomer)))
                .andExpect(status().isOk());

        ClubAdminAssignment claimed = clubAdminAssignmentRepository.findById(invitationId).orElseThrow();
        assertEquals(AssignmentStatus.ACTIVE, claimed.getStatus());
        assertEquals(newcomer.getId(), claimed.getUser().getId());
    }

    /**
     * The attack this closes: sign-up does not require confirming the address,
     * so without this rule anyone who registered the incoming treasurer's
     * address first would inherit the invitation sent to it.
     */
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

    /** Answered as a missing row, so ids cannot be walked to find open invitations. */
    @Test
    void someoneElsesInvitationIsNotFound() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User stranger = createConfirmedUser("Stranger", "stranger@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound());
    }

    @Test
    void anInvitationCannotBeAcceptedTwice() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("no longer open")));
    }

    @Test
    void decliningEndsTheInvitationWithoutGrantingAnything() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/decline".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isNoContent());

        ClubAdminAssignment declined = clubAdminAssignmentRepository.findById(invitationId).orElseThrow();
        assertEquals(AssignmentStatus.REVOKED, declined.getStatus());
        // Recorded against the invitee, so the owner can tell a declined
        // invitation from one they cancelled themselves.
        assertEquals(emma.getId(), declined.getRevokedByUserId());

        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isForbidden());
    }

    @Test
    void invitationsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/club-invitations"))
                .andExpect(status().isForbidden());
    }

    // --- removing -----------------------------------------------------------

    /** §28: revocation is effective on the next request, not the next login. */
    @Test
    void removingAnAdminEndsTheirAccessImmediately() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, owner);
        ClubAdminAssignment assignment = makeClubAdmin(club, michael);

        // The same bearer token throughout: it still carries whatever claims it
        // was issued with, and that must not matter.
        String michaelsToken = bearer(michael);

        mockMvc.perform(get("/api/v1/clubs/robotics/admins").header("Authorization", michaelsToken))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(assignment.getId()))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/clubs/robotics/admins").header("Authorization", michaelsToken))
                .andExpect(status().isForbidden());

        // §7: the row survives as REVOKED so the history stays answerable.
        ClubAdminAssignment removed = clubAdminAssignmentRepository.findById(assignment.getId()).orElseThrow();
        assertEquals(AssignmentStatus.REVOKED, removed.getStatus());
        assertEquals(owner.getId(), removed.getRevokedByUserId());
        assertTrue(mail().lastTo("michael@campus.com").isPresent(),
                "a removed administrator should be told");
    }

    @Test
    void cancellingAnInvitationLeavesNothingToAccept() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        Long invitationId = inviteAndReturnId(club, owner, "emma@campus.com");

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(invitationId))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(invitationId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isBadRequest());
    }

    /** §36: the owner cannot leave the club without an owner. */
    @Test
    void theOwnerCannotBeRemoved() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        ClubAdminAssignment ownerRow = makeClubOwner(club, owner);

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(ownerRow.getId()))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Transfer ownership instead")));

        assertTrue(clubAdminAssignmentRepository.findById(ownerRow.getId()).orElseThrow().isActiveOwner());
    }

    @Test
    void aClubAdminCannotRemoveAnyone() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, owner);
        makeClubAdmin(club, michael);
        ClubAdminAssignment emmasRow = makeClubAdmin(club, emma);

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(emmasRow.getId()))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isForbidden());
    }

    /**
     * §25: the club in the path is the one the caller was cleared for, so an
     * assignment id belonging to another club must not be reachable through it.
     */
    @Test
    void anAssignmentFromAnotherClubCannotBeRevokedThroughThisOne() throws Exception {
        Club robotics = createClub("robotics", "Robotics");
        Club chess = createClub("chess", "Chess");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(robotics, sarah);
        ClubAdminAssignment chessAdmin = makeClubAdmin(chess, michael);

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(chessAdmin.getId()))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNotFound());

        assertTrue(clubAdminAssignmentRepository.findById(chessAdmin.getId()).orElseThrow().isActive());
    }

    @Test
    void aPlatformAdminMayRemoveAnAdminFromAnyClub() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User platformAdmin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        makeClubOwner(club, owner);
        ClubAdminAssignment assignment = makeClubAdmin(club, michael);

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(assignment.getId()))
                        .header("Authorization", bearer(platformAdmin)))
                .andExpect(status().isNoContent());
    }

    // --- the club's official inbox ------------------------------------------

    /**
     * §17: security notices reach the organisation's own mailbox, so a change
     * of administrators cannot be made quietly. Nothing can set
     * {@code official_email} through the product yet, so this is set directly —
     * the point is that the notification path exists and fires.
     */
    @Test
    void theClubsOfficialInboxIsToldAboutAdministratorChanges() throws Exception {
        Club club = createClub("robotics", "Robotics");
        club.setOfficialEmail("robotics@campus.com");
        clubRepository.save(club);
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);

        inviteAndReturnId(club, owner, "emma@campus.com");

        assertTrue(mail().lastTo("robotics@campus.com").isPresent(),
                "the club inbox should be told about the invitation");
    }

    @Test
    void aClubWithoutAnOfficialInboxStillWorks() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, owner);

        inviteAndReturnId(club, owner, "emma@campus.com");

        assertEquals(1, mail().sent().size(),
                "only the invitee should be emailed when the club has no official address");
    }

    // --- the invariants underneath ------------------------------------------

    /**
     * The service checks first, but the index is what holds under a race. Saved
     * through the repository to bypass the service check, which is the only way
     * to reach the constraint.
     */
    @Test
    void databaseRefusesTwoLiveInvitationsToOneAddress() {
        Club club = createClub("robotics", "Robotics");

        ClubAdminAssignment first = new ClubAdminAssignment();
        first.setClub(club);
        first.setInvitedEmail("emma@campus.com");
        first.setRole(ClubRole.CLUB_ADMIN);
        first.setStatus(AssignmentStatus.PENDING);
        clubAdminAssignmentRepository.saveAndFlush(first);

        ClubAdminAssignment second = new ClubAdminAssignment();
        second.setClub(club);
        second.setInvitedEmail("EMMA@campus.com");
        second.setRole(ClubRole.CLUB_ADMIN);
        second.setStatus(AssignmentStatus.PENDING);

        assertThrows(DataIntegrityViolationException.class,
                () -> clubAdminAssignmentRepository.saveAndFlush(second));
    }

    /**
     * V15's CHECK constraint. An ACTIVE row without a user would be authority
     * granted to a mailbox, which nothing in the authorisation path could
     * evaluate — {@code ClubPermissionService} looks up (club_id, user_id).
     */
    @Test
    void databaseRefusesAnActiveAssignmentWithNoAccount() {
        Club club = createClub("robotics", "Robotics");

        ClubAdminAssignment orphan = new ClubAdminAssignment();
        orphan.setClub(club);
        orphan.setInvitedEmail("emma@campus.com");
        orphan.setRole(ClubRole.CLUB_ADMIN);
        orphan.activate();

        assertThrows(DataIntegrityViolationException.class,
                () -> clubAdminAssignmentRepository.saveAndFlush(orphan));
    }

    @Test
    void databaseRefusesARowThatNamesNobody() {
        Club club = createClub("robotics", "Robotics");

        ClubAdminAssignment anonymous = new ClubAdminAssignment();
        anonymous.setClub(club);
        anonymous.setRole(ClubRole.CLUB_ADMIN);
        anonymous.setStatus(AssignmentStatus.PENDING);

        assertThrows(DataIntegrityViolationException.class,
                () -> clubAdminAssignmentRepository.saveAndFlush(anonymous));
    }
}
