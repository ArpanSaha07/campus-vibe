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

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Handing a club to its next owner — MVP item 8.
 *
 * <p>The property everything else here serves is §9: a club has exactly one
 * active owner, before the transfer and after it, and never zero or two in
 * between. A club in either of those states cannot repair itself, because
 * repairing it is an owner-only act.
 *
 * <p>{@code transferSurvivesWhenTheOldOwnerStays} guards a specific hazard.
 * {@code one_active_owner_per_club} is a partial unique <em>index</em>, which
 * PostgreSQL checks per statement — partial indexes cannot be DEFERRABLE — so
 * the demotion has to reach the database before the promotion, and the service
 * pins that order with an explicit flush. Note that removing the flush does
 * <em>not</em> currently fail this test: Hibernate happens to emit the two
 * updates in the order they were dirtied. The flush is there because that is
 * not a guarantee, not because the test proves it necessary — so do not read a
 * green run here as evidence the ordering does not matter.
 */
@Import(ClubOwnershipTransferIT.MailTestConfig.class)
class ClubOwnershipTransferIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class MailTestConfig {
        @Bean
        @Primary
        MailSender recordingMailSender() {
            return new RecordingMailSender();
        }
    }

    @Autowired private MailSender mailSender;
    @Autowired private ClubOwnershipTransferRepository transferRepository;

    private RecordingMailSender mail() {
        return (RecordingMailSender) mailSender;
    }

    @BeforeEach
    void clearMail() {
        // Transfers are cleared by AbstractIntegrationTest, which owns the
        // delete order across every table.
        mail().clear();
    }

    // --- fixtures -----------------------------------------------------------

    private User createConfirmedUser(String name, String email) {
        User user = createUser(name, email, "password123", RoleName.ROLE_USER);
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private String transferBody(Long toUserId, String outgoingBecomes) throws Exception {
        return objectMapper.writeValueAsString(
                Map.of("toUserId", toUserId, "outgoingBecomes", outgoingBecomes));
    }

    private Long offer(Club club, User owner, User successor, String outgoingBecomes) throws Exception {
        String response = mockMvc.perform(
                        post("/api/v1/clubs/%s/ownership-transfer".formatted(club.getId()))
                                .header("Authorization", bearer(owner))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(transferBody(successor.getId(), outgoingBecomes)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("transferId").asLong();
    }

    /** The state the invariant is about: who owns this club, according to the table. */
    private Long activeOwnerIdOf(String clubId) {
        return clubAdminAssignmentRepository
                .findByClubIdAndRoleAndStatus(clubId, ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)
                .map(a -> a.getUser().getId())
                .orElse(null);
    }

    // --- offering -----------------------------------------------------------

    @Test
    void ownerOffersTheClubToAnAdmin() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(michael.getId(), "CLUB_ADMIN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.fromUserName", is("Sarah")))
                .andExpect(jsonPath("$.toUserName", is("Michael")))
                .andExpect(jsonPath("$.outgoingBecomes", is("CLUB_ADMIN")));

        assertTrue(mail().lastTo("michael@campus.com").isPresent(),
                "the successor should be told");
    }

    /** §8: nothing moves until the successor accepts. */
    @Test
    void offeringMovesNoAuthority() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        offer(club, sarah, michael, "CLUB_ADMIN");

        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"),
                "the sitting owner is still the owner while the offer is open");

        // And still holds the powers that go with it.
        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "new@campus.com"))))
                .andExpect(status().isCreated());

        // The successor does not yet.
        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(michael))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "other@campus.com"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownershipCannotBeOfferedToSomeoneWhoIsNotAnAdmin() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User stranger = createConfirmedUser("Stranger", "stranger@campus.com");
        makeClubOwner(club, sarah);

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(stranger.getId(), "CLUB_ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("only be handed to one of this club's admins")));
    }

    /** A pending invitation is not membership, so it is not eligibility either. */
    @Test
    void ownershipCannotBeOfferedToSomeoneWithOnlyAPendingInvitation() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "emma@campus.com"))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(emma.getId(), "CLUB_ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anAdminCannotOfferTheClub() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(michael))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(emma.getId(), "CLUB_ADMIN")))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyOneHandoverMayBeInFlight() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);
        offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(emma.getId(), "CLUB_ADMIN")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("already has a handover waiting")));
    }

    @Test
    void theTeamCanSeeAHandoverIsInFlight() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);

        // Nothing in flight yet.
        mockMvc.perform(get("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isNoContent());

        offer(club, sarah, michael, "CLUB_ADMIN");

        // An admin who is not the successor still sees it — the club is
        // changing hands, which is not a private matter within the team.
        mockMvc.perform(get("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.toUserName", is("Michael")));
    }

    @Test
    void anOutsiderCannotSeeAHandover() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User outsider = createConfirmedUser("Outsider", "outsider@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(get("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());

        // And the endpoint is not public, despite sitting under /api/v1/clubs/**.
        mockMvc.perform(get("/api/v1/clubs/robotics/ownership-transfer"))
                .andExpect(status().isForbidden());
    }

    // --- accepting ----------------------------------------------------------

    /**
     * The whole point, and the test that would catch a missing flush between
     * the demotion and the promotion.
     */
    @Test
    void transferSurvivesWhenTheOldOwnerStays() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clubId", is("robotics")))
                .andExpect(jsonPath("$.role", is("CLUB_OWNER")));

        assertEquals(michael.getId(), activeOwnerIdOf("robotics"));

        // Sarah stayed, as an admin.
        ClubAdminAssignment sarahRow = clubAdminAssignmentRepository
                .findByClubIdAndUserIdAndStatus("robotics", sarah.getId(), AssignmentStatus.ACTIVE)
                .orElseThrow();
        assertEquals(ClubRole.CLUB_ADMIN, sarahRow.getRole());

        // Exactly one owner, asked of the database rather than the mapping.
        Integer owners = jdbcTemplate.queryForObject(
                "select count(*) from club_admin_assignments "
                        + "where club_id = 'robotics' and role = 'CLUB_OWNER' and status = 'ACTIVE'",
                Integer.class);
        assertEquals(1, owners);
    }

    @Test
    void transferCanAlsoRemoveTheOldOwner() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "REVOKED");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());

        assertEquals(michael.getId(), activeOwnerIdOf("robotics"));

        assertTrue(clubAdminAssignmentRepository
                        .findByClubIdAndUserIdAndStatus("robotics", sarah.getId(), AssignmentStatus.ACTIVE)
                        .isEmpty(),
                "the outgoing owner asked to leave, so they hold nothing");

        // Access ends on the next request, on the token she already had.
        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isForbidden());
    }

    /** §36 read from the other end: after handing over, the old owner can be removed. */
    @Test
    void theNewOwnerCanRemoveThePreviousOne() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        ClubAdminAssignment sarahRow = makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());

        // Sarah's row was the owner row and is now an admin row, so the rule
        // that owner rows cannot be removed no longer protects it.
        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(sarahRow.getId()))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isNoContent());
    }

    @Test
    void someoneElsesHandoverIsNotFound() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isNotFound());

        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"));
    }

    /**
     * An offer can sit for days, so the world is re-read at acceptance rather
     * than trusted from when it was made.
     */
    @Test
    void aSuccessorRemovedInTheMeantimeCannotAccept() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        ClubAdminAssignment michaelRow = makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(michaelRow.getId()))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isBadRequest());

        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"));
    }

    /** Removing the successor also clears the handover, so the slot is not held. */
    @Test
    void removingTheSuccessorCancelsTheHandover() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);
        ClubAdminAssignment michaelRow = makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(michaelRow.getId()))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());

        assertEquals(TransferStatus.CANCELLED,
                transferRepository.findById(transferId).orElseThrow().getStatus());

        // And the club can immediately start a new one.
        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(transferBody(emma.getId(), "CLUB_ADMIN")))
                .andExpect(status().isCreated());
    }

    @Test
    void aHandoverCannotBeAcceptedTwice() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("no longer open")));
    }

    @Test
    void anUnconfirmedAccountCannotAcceptAClub() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        // An admin row that never went through the invitation flow, which is
        // the only way an unconfirmed account can hold one.
        User michael = createUser("Michael", "michael@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("Confirm your email address")));

        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"));
    }

    // --- declining and cancelling -------------------------------------------

    @Test
    void decliningLeavesEverythingAsItWas() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/decline".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isNoContent());

        assertEquals(TransferStatus.DECLINED,
                transferRepository.findById(transferId).orElseThrow().getStatus());
        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"));

        // Michael keeps the admin role he already had.
        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());
    }

    @Test
    void theOwnerCanWithdrawTheOffer() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        Long transferId = offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(delete("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isBadRequest());

        assertEquals(sarah.getId(), activeOwnerIdOf("robotics"));
    }

    @Test
    void theSuccessorSeesTheOfferOnTheirOwnList() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);
        offer(club, sarah, michael, "CLUB_ADMIN");

        mockMvc.perform(get("/api/v1/users/me/ownership-transfers")
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].clubName", is("Robotics")))
                .andExpect(jsonPath("$[0].fromUserName", is("Sarah")));

        mockMvc.perform(get("/api/v1/users/me/ownership-transfers")
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // --- the invariants underneath ------------------------------------------

    @Test
    void databaseRefusesTwoPendingHandoversForOneClub() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");

        transferRepository.saveAndFlush(pending(club, sarah, michael));

        assertThrows(DataIntegrityViolationException.class,
                () -> transferRepository.saveAndFlush(pending(club, sarah, emma)));
    }

    @Test
    void databaseRefusesAHandoverToYourself() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");

        assertThrows(DataIntegrityViolationException.class,
                () -> transferRepository.saveAndFlush(pending(club, sarah, sarah)));
    }

    /** The CHECK tying resolved_at to status, so a forgotten timestamp is loud. */
    @Test
    void databaseRefusesAResolvedHandoverWithNoTimestamp() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");

        ClubOwnershipTransfer transfer = pending(club, sarah, michael);
        transfer.setStatus(TransferStatus.ACCEPTED);   // without resolveAs, so no timestamp

        assertThrows(DataIntegrityViolationException.class,
                () -> transferRepository.saveAndFlush(transfer));
    }

    @Test
    void flywayAppliedTheOwnershipTransferMigration() {
        List<String> applied = jdbcTemplate.queryForList(
                "select version from flyway_schema_history where success order by installed_rank",
                String.class);
        assertTrue(applied.contains("16"), "expected V16 to be applied, got " + applied);
    }

    private static ClubOwnershipTransfer pending(Club club, User from, User to) {
        ClubOwnershipTransfer transfer = new ClubOwnershipTransfer();
        transfer.setClub(club);
        transfer.setFromUser(from);
        transfer.setToUser(to);
        transfer.setOutgoingBecomes(ClubOwnershipTransfer.OutgoingOwner.CLUB_ADMIN);
        transfer.setStatus(TransferStatus.PENDING);
        return transfer;
    }
}
