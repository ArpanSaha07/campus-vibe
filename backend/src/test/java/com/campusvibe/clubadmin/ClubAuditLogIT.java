package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The club activity log — MVP items 9 and 10.
 *
 * <p>Two things are being asserted here, and they are different in kind. Most of
 * these tests say that an action produces the entry it should, with enough in it
 * to render a sentence months later. The last few say that an entry, once
 * written, cannot be changed or removed by anything — which is §22, and which is
 * the only part a determined club administrator would have a motive to attack.
 */
class ClubAuditLogIT extends AbstractIntegrationTest {

    @Autowired private ClubAuditLogRepository auditLogRepository;

    private User createConfirmedUser(String name, String email) {
        User user = createUser(name, email, "password123", RoleName.ROLE_USER);
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private List<ClubAuditLog> entriesFor(String clubId) {
        return auditLogRepository.findByClubIdOrderByIdDesc(
                clubId, org.springframework.data.domain.Limit.of(100));
    }

    private ClubAuditLog latest(String clubId) {
        List<ClubAuditLog> entries = entriesFor(clubId);
        assertFalse(entries.isEmpty(), "expected at least one audit entry");
        return entries.getFirst();
    }

    // --- the entries themselves ---------------------------------------------

    @Test
    void invitingAnAdminIsRecorded() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "newcomer@campus.com"))))
                .andExpect(status().isCreated());

        ClubAuditLog entry = latest("robotics");
        assertEquals(ClubAuditAction.CLUB_ADMIN_INVITED, entry.getAction());
        assertEquals(AuditEntityType.CLUB_ADMIN_ASSIGNMENT, entry.getEntityType());
        assertEquals(sarah.getId(), entry.getActorUserId());
        assertEquals("Sarah", entry.getActorName());
        // The address is the whole identity of an invitee with no account, so
        // without it the entry could not say who was invited.
        assertEquals("newcomer@campus.com", entry.getMetadata().get("invitedEmail"));
        assertNotNull(entry.getEntityId());
    }

    @Test
    void theWholeAdminLifecycleLeavesATrail() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);

        String response = mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "emma@campus.com"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long assignmentId = objectMapper.readTree(response).get("assignmentId").asLong();

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(assignmentId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(assignmentId))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());

        List<ClubAuditAction> actions = entriesFor("robotics").stream()
                .map(ClubAuditLog::getAction)
                .toList();
        // Newest first.
        assertEquals(List.of(
                ClubAuditAction.CLUB_ADMIN_REMOVED,
                ClubAuditAction.CLUB_ADMIN_ADDED,
                ClubAuditAction.CLUB_ADMIN_INVITED), actions);
    }

    /** Accepting is recorded against the invitee, not the owner who invited them. */
    @Test
    void acceptingIsAttributedToTheInvitee() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User emma = createConfirmedUser("Emma", "emma@campus.com");
        makeClubOwner(club, sarah);

        String response = mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "emma@campus.com"))))
                .andReturn().getResponse().getContentAsString();
        Long assignmentId = objectMapper.readTree(response).get("assignmentId").asLong();

        mockMvc.perform(post("/api/v1/users/me/club-invitations/%d/accept".formatted(assignmentId))
                        .header("Authorization", bearer(emma)))
                .andExpect(status().isOk());

        ClubAuditLog entry = latest("robotics");
        assertEquals(ClubAuditAction.CLUB_ADMIN_ADDED, entry.getAction());
        assertEquals(emma.getId(), entry.getActorUserId());
        assertEquals("Emma", entry.getActorName());
    }

    /** Cancelling an invitation and removing an admin share an action, so the
     *  entry has to carry which one it was. */
    @Test
    void cancellingAnInvitationIsDistinguishableFromRemovingAnAdmin() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        ClubAdminAssignment michaelRow = makeClubAdmin(club, michael);

        String response = mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "pending@campus.com"))))
                .andReturn().getResponse().getContentAsString();
        Long invitationId = objectMapper.readTree(response).get("assignmentId").asLong();

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(invitationId))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());
        assertEquals("true", latest("robotics").getMetadata().get("wasInvitation"));

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(michaelRow.getId()))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());
        ClubAuditLog removal = latest("robotics");
        assertEquals("false", removal.getMetadata().get("wasInvitation"));
        assertEquals("Michael", removal.getMetadata().get("targetName"));
    }

    @Test
    void aHandoverIsRecordedFromOfferToCompletion() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);

        String response = mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("toUserId", michael.getId(), "outgoingBecomes", "REVOKED"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long transferId = objectMapper.readTree(response).get("transferId").asLong();

        mockMvc.perform(post("/api/v1/users/me/ownership-transfers/%d/accept".formatted(transferId))
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());

        List<ClubAuditLog> entries = entriesFor("robotics");
        ClubAuditLog completed = entries.getFirst();
        assertEquals(ClubAuditAction.OWNERSHIP_TRANSFER_COMPLETED, completed.getAction());
        assertEquals(AuditEntityType.CLUB_OWNERSHIP_TRANSFER, completed.getEntityType());
        assertEquals("Sarah", completed.getMetadata().get("fromName"));
        assertEquals("Michael", completed.getMetadata().get("toName"));
        // Without this the entry could not explain why Sarah stopped being an
        // administrator at the same moment.
        assertEquals("REVOKED", completed.getMetadata().get("outgoingBecomes"));

        assertEquals(ClubAuditAction.OWNERSHIP_TRANSFER_REQUESTED, entries.get(1).getAction());
        assertEquals(sarah.getId(), entries.get(1).getActorUserId());
    }

    /**
     * A handover voided because the successor was removed has no actor: nobody
     * cancelled it. Recording the remover would read as them withdrawing a
     * handover they may not have known existed.
     */
    @Test
    void aVoidedHandoverIsRecordedWithNoActor() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        makeClubOwner(club, sarah);
        ClubAdminAssignment michaelRow = makeClubAdmin(club, michael);

        mockMvc.perform(post("/api/v1/clubs/robotics/ownership-transfer")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("toUserId", michael.getId(), "outgoingBecomes", "CLUB_ADMIN"))))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/v1/clubs/robotics/admins/%d".formatted(michaelRow.getId()))
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isNoContent());

        ClubAuditLog voided = entriesFor("robotics").stream()
                .filter(e -> e.getAction() == ClubAuditAction.OWNERSHIP_TRANSFER_CANCELLED)
                .findFirst()
                .orElseThrow();
        assertNull(voided.getActorUserId());
        assertEquals("CampusVibe", voided.getActorName());
        assertEquals("SUCCESSOR_REMOVED", voided.getMetadata().get("reason"));
    }

    /**
     * The actor's name is a snapshot. Renaming the account must not rewrite what
     * the log says happened that day.
     */
    @Test
    void theActorsNameIsFrozenAtTheMoment() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "someone@campus.com"))))
                .andExpect(status().isCreated());

        sarah.setName("Sarah Renamed");
        userRepository.save(sarah);

        assertEquals("Sarah", latest("robotics").getActorName());
    }

    // --- reading it ---------------------------------------------------------

    @Test
    void theWholeManagementTeamCanReadTheLog() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        User michael = createConfirmedUser("Michael", "michael@campus.com");
        User outsider = createConfirmedUser("Outsider", "outsider@campus.com");
        makeClubOwner(club, sarah);
        makeClubAdmin(club, michael);

        // §19: admins too, not just the owner.
        mockMvc.perform(get("/api/v1/clubs/robotics/audit-logs")
                        .header("Authorization", bearer(michael)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/clubs/robotics/audit-logs")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());

        // Not public, despite sitting under the otherwise-public /clubs/**.
        mockMvc.perform(get("/api/v1/clubs/robotics/audit-logs"))
                .andExpect(status().isForbidden());
    }

    @Test
    void theLogPagesNewestFirst() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                            .header("Authorization", bearer(sarah))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("email", "invitee%d@campus.com".formatted(i)))))
                    .andExpect(status().isCreated());
        }

        String firstPage = mockMvc.perform(get("/api/v1/clubs/robotics/audit-logs?limit=2")
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andReturn().getResponse().getContentAsString();

        long firstId = objectMapper.readTree(firstPage).get(0).get("id").asLong();
        long secondId = objectMapper.readTree(firstPage).get(1).get("id").asLong();
        assertTrue(firstId > secondId, "newest first");

        // The cursor is the last id seen, so the next page starts strictly below
        // it and cannot repeat the row on the boundary.
        mockMvc.perform(get("/api/v1/clubs/robotics/audit-logs?limit=2&before=" + secondId)
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id", lessThan((int) secondId)));
    }

    @Test
    void oneClubsLogNeverShowsAnothers() throws Exception {
        Club robotics = createClub("robotics", "Robotics");
        Club chess = createClub("chess", "Chess");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(robotics, sarah);
        makeClubOwner(chess, sarah);

        mockMvc.perform(post("/api/v1/clubs/robotics/admins/invitations")
                        .header("Authorization", bearer(sarah))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "someone@campus.com"))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/clubs/chess/audit-logs")
                        .header("Authorization", bearer(sarah)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // --- §22: it cannot be rewritten ----------------------------------------

    /**
     * The rule the whole section exists for. A club administrator with a motive
     * to remove the entry recording what they did cannot, because the refusal is
     * in the database rather than in the code they might change.
     */
    @Test
    void anEntryCannotBeDeleted() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        jdbcTemplate.update(
                "insert into club_audit_logs (club_id, actor_user_id, actor_name, action, entity_type) "
                        + "values ('robotics', ?, 'Sarah', 'CLUB_ADMIN_INVITED', 'CLUB_ADMIN_ASSIGNMENT')",
                sarah.getId());

        DataAccessException failure = assertThrows(DataAccessException.class,
                () -> jdbcTemplate.update("delete from club_audit_logs where club_id = 'robotics'"));
        assertTrue(failure.getMessage().contains("append-only"),
                "the refusal should say why: " + failure.getMessage());
    }

    @Test
    void anEntryCannotBeEdited() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        jdbcTemplate.update(
                "insert into club_audit_logs (club_id, actor_user_id, actor_name, action, entity_type) "
                        + "values ('robotics', ?, 'Sarah', 'CLUB_ADMIN_REMOVED', 'CLUB_ADMIN_ASSIGNMENT')",
                sarah.getId());

        assertThrows(DataAccessException.class,
                () -> jdbcTemplate.update(
                        "update club_audit_logs set actor_name = 'Somebody Else' where club_id = 'robotics'"));
    }

    /**
     * The log outlives what it describes. No foreign key to clubs, so deleting
     * a club leaves its history standing — and the delete is not blocked by the
     * append-only trigger, because no audit row is touched by it.
     */
    @Test
    void theLogSurvivesTheClubItDescribes() {
        Club club = createClub("robotics", "Robotics");
        User sarah = createConfirmedUser("Sarah", "sarah@campus.com");
        makeClubOwner(club, sarah);

        jdbcTemplate.update(
                "insert into club_audit_logs (club_id, actor_user_id, actor_name, action, entity_type) "
                        + "values ('robotics', ?, 'Sarah', 'CLUB_ADMIN_INVITED', 'CLUB_ADMIN_ASSIGNMENT')",
                sarah.getId());

        clubAdminAssignmentRepository.deleteAll();
        assertDoesNotThrow(() -> clubRepository.deleteById("robotics"));

        assertEquals(1, entriesFor("robotics").size(),
                "the history should outlive the club");
    }

    @Test
    void flywayAppliedTheAuditMigration() {
        List<String> applied = jdbcTemplate.queryForList(
                "select version from flyway_schema_history where success order by installed_rank",
                String.class);
        assertTrue(applied.contains("17"), "expected V17 to be applied, got " + applied);
    }
}
