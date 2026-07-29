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

class ClubAdminRequestFlowIntegrationTest extends AbstractIntegrationTest {

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
    void fullApprovalFlowGrantsRoleAndClubOwnership() throws Exception {
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

        // Admin approves
        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("APPROVED")))
                .andExpect(jsonPath("$.reviewedAt", notNullValue()));

        // User now has ROLE_CLUB_ADMIN and owns the club
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertTrue(reloaded.hasRole(RoleName.ROLE_CLUB_ADMIN));
        assertTrue(reloaded.hasRole(RoleName.ROLE_USER));
        Club club = clubRepository.findById("chess-club").orElseThrow();
        assertEquals(user.getId(), club.getClubAdminId());

        // A fresh login token carries the new role
        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "uma@campus.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(loginResponse).get("token").asText();
        assertTrue(jwtUtil.getRoles(token).contains("ROLE_CLUB_ADMIN"));

        // /my-club resolves ownership from the database
        mockMvc.perform(get("/api/v1/clubs/my-club")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("chess-club")));
    }

    @Test
    void rejectionLeavesUserWithoutRole() throws Exception {
        User user = createUser("Vic", "vic@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root2@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        createClub("art-club", "Art Club");

        long requestId = submitRequest(user, "art-club");

        mockMvc.perform(post("/api/v1/club-admin-requests/" + requestId + "/reject")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REJECTED")));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertFalse(reloaded.hasRole(RoleName.ROLE_CLUB_ADMIN));
        assertNull(clubRepository.findById("art-club").orElseThrow().getClubAdminId());
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
    void requestForClubThatAlreadyHasAdminIsRejected() throws Exception {
        User owner = createUser("Owner", "owner@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        Club club = createClub("run-club", "Run Club");
        club.setClubAdminId(owner.getId());
        clubRepository.save(club);

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

    @Test
    void clubAdminCanManageOnlyTheirOwnClub() throws Exception {
        User clubAdmin = createUser("Cam", "cam@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        Club owned = createClub("own-club", "Own Club");
        owned.setClubAdminId(clubAdmin.getId());
        clubRepository.save(owned);
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

        // Admin bypasses ownership
        User admin = createUser("Root", "root4@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(eventForOtherClub)))
                .andExpect(status().isOk());
    }

    @Test
    void clubUpdateIsOwnershipGuarded() throws Exception {
        User clubAdmin = createUser("Gus", "gus@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        Club owned = createClub("cook-club", "Cook Club");
        owned.setClubAdminId(clubAdmin.getId());
        clubRepository.save(owned);
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
