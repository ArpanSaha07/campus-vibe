package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The platform-admin bootstrap path: a student asks to run an ownerless club,
 * an admin approves, and the student becomes its CLUB_OWNER.
 *
 * <p>Approval used to grant the account-wide ROLE_CLUB_ADMIN and stamp
 * clubs.club_admin_id. It now writes one club_admin_assignments row and touches
 * the user's roles not at all — which is what the JWT assertions below check.
 */
class ClubAdminRequestFlowIT extends AbstractIntegrationTest {

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private long submitRequest(User user, String clubId) throws Exception {
        String response = mockMvc.perform(post("/api/v1/club-admin-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("clubId", clubId, "message", "I run this club IRL"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void fullApprovalFlowMakesRequesterTheClubOwner() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        createClub("chess-club", "Chess Club");

        long requestId = submitRequest(user, "chess-club");

        // Admin sees it in the pending list
        mockMvc.perform(get("/api/v1/club-admin-requests?status=PENDING")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userEmail", is("uma@campus.com")))
                .andExpect(jsonPath("$[0].clubId", is("chess-club")));

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("APPROVED")))
                .andExpect(jsonPath("$.reviewedAt", notNullValue()));

        // Authority is the assignment, scoped to this one club, and it records
        // which platform admin granted it.
        ClubAdminAssignment assignment = clubAdminAssignmentRepository
                .findByClubIdAndUserIdAndStatus("chess-club", user.getId(), AssignmentStatus.ACTIVE)
                .orElseThrow();
        assertEquals(ClubRole.CLUB_OWNER, assignment.getRole());
        assertNotNull(assignment.getActivatedAt());
        assertEquals(admin.getId(), assignment.getInvitedByUserId());

        // The account's platform roles are untouched — becoming a club owner is
        // not a promotion, and nothing about it belongs in the token.
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(roleNamesOf(user), roleNamesOf(reloaded));

        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "uma@campus.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(loginResponse).get("token").asText();
        assertEquals(java.util.List.of("ROLE_USER"), jwtUtil.getRoles(token));

        // The club shows up in the caller's managed list, with the role held.
        mockMvc.perform(get("/api/v1/users/me/managed-clubs")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].clubId", is("chess-club")))
                .andExpect(jsonPath("$[0].role", is("CLUB_OWNER")))
                .andExpect(jsonPath("$[0].officialEmail", nullValue()));
    }

    @Test
    void rejectionGrantsNothing() throws Exception {
        User user = createUser("Vic", "vic@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root2@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        createClub("art-club", "Art Club");

        long requestId = submitRequest(user, "art-club");

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/reject")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REJECTED")));

        assertTrue(clubAdminAssignmentRepository
                .findByClubIdAndUserIdAndStatus("art-club", user.getId(), AssignmentStatus.ACTIVE)
                .isEmpty());
        assertFalse(clubAdminAssignmentRepository.existsByClubIdAndRoleAndStatus(
                "art-club", ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE));
    }

    @Test
    void nonAdminCannotListOrReviewRequests() throws Exception {
        User user = createUser("Wes", "wes@campus.com", "password123", RoleName.ROLE_USER);
        createClub("film-club", "Film Club");
        long requestId = submitRequest(user, "film-club");

        mockMvc.perform(get("/api/v1/club-admin-requests")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden());
    }

    @Test
    void requestForClubThatAlreadyHasAnOwnerIsRejected() throws Exception {
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        Club club = createClub("run-club", "Run Club");
        makeClubOwner(club, owner);

        User user = createUser("Xena", "xena@campus.com", "password123", RoleName.ROLE_USER);
        mockMvc.perform(post("/api/v1/club-admin-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("clubId", "run-club", "message", "me too"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void duplicatePendingRequestIsRejected() throws Exception {
        User user = createUser("Yan", "yan@campus.com", "password123", RoleName.ROLE_USER);
        createClub("go-club", "Go Club");

        submitRequest(user, "go-club");

        mockMvc.perform(post("/api/v1/club-admin-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("clubId", "go-club", "message", "again"))))
                .andExpect(status().isConflict());
    }

    @Test
    void alreadyReviewedRequestCannotBeReviewedAgain() throws Exception {
        User user = createUser("Zed", "zed@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root3@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        createClub("ski-club", "Ski Club");
        long requestId = submitRequest(user, "ski-club");

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
    }

    /**
     * A second approval for a club that gained an owner while the request sat
     * in the queue must fail rather than depose the sitting owner.
     */
    @Test
    void approvingAStaleRequestCannotDeposeTheSittingOwner() throws Exception {
        User first = createUser("Ada", "ada@campus.com", "password123", RoleName.ROLE_USER);
        User second = createUser("Bo", "bo@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root5@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        Club club = createClub("row-club", "Row Club");

        long staleRequest = submitRequest(second, "row-club");
        makeClubOwner(club, first); // someone else takes the club in the meantime

        mockMvc.perform(post("/api/v1/club-admin-requests/" + staleRequest + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());

        ClubAdminAssignment owner = clubAdminAssignmentRepository
                .findByClubIdAndRoleAndStatus("row-club", ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)
                .orElseThrow();
        assertEquals(first.getId(), owner.getUser().getId());
    }

    @Test
    void clubAdminCanManageOnlyTheirOwnClub() throws Exception {
        User clubAdmin = createUser("Cam", "cam@campus.com", "password123", RoleName.ROLE_USER);
        Club owned = createClub("own-club", "Own Club");
        makeClubOwner(owned, clubAdmin);
        createClub("other-club", "Other Club");

        Map<String, Object> eventForOwnClub = Map.of(
                "title", "Meetup", "dateTime", Instant.now().toString(), "organizerId", "own-club");
        Map<String, Object> eventForOtherClub = Map.of(
                "title", "Hijack", "dateTime", Instant.now().toString(), "organizerId", "other-club");

        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", bearer(clubAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(eventForOwnClub)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizerId", is("own-club")));

        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", bearer(clubAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(eventForOtherClub)))
                .andExpect(status().isForbidden());

        // Plain users cannot create events at all
        User plain = createUser("Pat", "pat@campus.com", "password123", RoleName.ROLE_USER);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", bearer(plain))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(eventForOwnClub)))
                .andExpect(status().isForbidden());

        // Admin bypasses club scope
        User admin = createUser("Root", "root4@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(eventForOtherClub)))
                .andExpect(status().isOk());
    }

    /**
     * The point of the whole rewrite: revoking an assignment takes effect on
     * the next request, against a token issued before the revocation.
     */
    @Test
    void revokingAnAssignmentEndsAccessWithoutReissuingTheToken() throws Exception {
        User clubAdmin = createUser("Rex", "rex@campus.com", "password123", RoleName.ROLE_USER);
        Club club = createClub("dev-club", "Dev Club");
        ClubAdminAssignment assignment = makeClubAdmin(club, clubAdmin);

        String token = bearer(clubAdmin); // issued while they still had authority

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/clubs/dev-club")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("description", "We ship."))))
                .andExpect(status().isOk());

        assignment.revoke(null);
        clubAdminAssignmentRepository.save(assignment);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/clubs/dev-club")
                        .header("Authorization", token) // the very same token
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("description", "Still here?"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubUpdateIsOwnershipGuarded() throws Exception {
        User clubAdmin = createUser("Gus", "gus@campus.com", "password123", RoleName.ROLE_USER);
        Club owned = createClub("cook-club", "Cook Club");
        makeClubOwner(owned, clubAdmin);
        createClub("bake-club", "Bake Club");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/clubs/cook-club")
                        .header("Authorization", bearer(clubAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("description", "We cook."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description", is("We cook.")));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/clubs/bake-club")
                        .header("Authorization", bearer(clubAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("description", "Not mine"))))
                .andExpect(status().isForbidden());
    }
}
