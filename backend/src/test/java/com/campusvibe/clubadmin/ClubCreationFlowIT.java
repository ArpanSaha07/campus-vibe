package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The two paths that create a club, and the platform-admin write for a club's
 * official email.
 *
 * <p>What this exists to hold: a club is never born ownerless (ADR-004), a
 * proposal writes no {@code clubs} row until it is approved (ADR-005), and
 * setting an official email never marks it verified (ADR-006).
 */
class ClubCreationFlowIT extends AbstractIntegrationTest {

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private Map<String, Object> proposal(String name, String slug) {
        return Map.of(
                "id", slug,
                "name", name,
                "description", "A club for people who like " + name,
                "message", "I already run this in real life");
    }

    // ---------------------------------------------------------------- admin path

    @Test
    void adminCreatingAClubBecomesItsOwnerAndCanManageItImmediately() throws Exception {
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        mockMvc.perform(post("/api/v1/clubs")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("id", "robotics", "name", "Robotics"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("robotics")));

        ClubAdminAssignment assignment = clubAdminAssignmentRepository
                .findByClubIdAndUserIdAndStatus("robotics", admin.getId(), AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new AssertionError("the creating admin was not made owner"));
        assertEquals(ClubRole.CLUB_OWNER, assignment.getRole());
        assertNotNull(assignment.getActivatedAt());

        // The P0 this closes: every follow-up the create form wants to make used
        // to 403 against canManageClub. The owner assignment is what fixes it,
        // so this asserts through PUT rather than through the admin bypass --
        // note the assignment lookup above proves the pass is by assignment.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/clubs/robotics")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("socialLinks", "{\"email\":\"robotics@campus.com\"}"))))
                .andExpect(status().isOk());
    }

    @Test
    void anOrdinaryUserCannotCreateAClubDirectly() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/clubs")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("id", "robotics", "name", "Robotics"))))
                .andExpect(status().isForbidden());

        assertFalse(clubRepository.existsById("robotics"),
                "a refused create must not leave a club behind");
    }

    // ------------------------------------------------------------- proposal path

    @Test
    void aProposalCreatesNoClubUntilItIsApproved() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        String response = mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(proposal("Robotics", "robotics"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.createdClubId", nullValue()))
                .andReturn().getResponse().getContentAsString();
        long requestId = objectMapper.readTree(response).get("id").asLong();

        // The whole point of ADR-005: nothing public can leak an unapproved club,
        // because there is no row to leak.
        assertFalse(clubRepository.existsById("robotics"));
        mockMvc.perform(get("/api/v1/clubs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(post("/api/v1/club-creation-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("APPROVED")))
                .andExpect(jsonPath("$.reviewedAt", notNullValue()))
                .andExpect(jsonPath("$.createdClubId", is("robotics")));

        // Both rows, and the owner is the requester rather than the approver.
        assertTrue(clubRepository.existsById("robotics"));
        ClubAdminAssignment assignment = clubAdminAssignmentRepository
                .findByClubIdAndUserIdAndStatus("robotics", user.getId(), AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new AssertionError("the requester was not made owner"));
        assertEquals(ClubRole.CLUB_OWNER, assignment.getRole());
        assertEquals(admin.getId(), assignment.getInvitedByUserId(),
                "the approving admin is recorded as having granted it");
    }

    @Test
    void rejectingAProposalCreatesNothing() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        String response = mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(proposal("Robotics", "robotics"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long requestId = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(post("/api/v1/club-creation-requests/" + requestId + "/reject")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REJECTED")))
                .andExpect(jsonPath("$.createdClubId", nullValue()));

        assertFalse(clubRepository.existsById("robotics"));
        assertEquals(0, clubAdminAssignmentRepository.count());
    }

    @Test
    void aSecondPendingProposalForTheSameSlugIsRefused() throws Exception {
        User first = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User second = createUser("Ada", "ada@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(first))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(proposal("Robotics", "robotics"))))
                .andExpect(status().isOk());

        // Refused at submission, where the form is already checking name
        // availability and can say something useful -- not at approval, by which
        // point the loser has been waiting in a queue.
        mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(second))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(proposal("Robotics", "ROBOTICS"))))
                .andExpect(status().isConflict());

        assertEquals(1, clubCreationRequestRepository.count());
    }

    @Test
    void approvingAProposalWhoseSlugWasTakenMeanwhileFailsWithAMessage() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        String response = mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(proposal("Robotics", "robotics"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long requestId = objectMapper.readTree(response).get("id").asLong();

        // The race the slug reservation cannot cover: the partial unique index
        // is over proposals, and this writes to `clubs`.
        createClub("robotics", "Robotics Society");

        mockMvc.perform(post("/api/v1/club-creation-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());

        // Still reviewable -- the admin has to reject it and ask for another
        // name, which they cannot do if approval left it APPROVED.
        ClubCreationRequest req = clubCreationRequestRepository.findById(requestId).orElseThrow();
        assertEquals(RequestStatus.PENDING, req.getStatus());
        assertNull(req.getCreatedClubId());
        assertEquals(0, clubAdminAssignmentRepository.count(),
                "a failed approval must not leave an owner on somebody else's club");
    }

    @Test
    void theProposalQueueIsAdminOnly() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/club-creation-requests?status=PENDING")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden());

        // And not readable at all without a token. 403 rather than 401:
        // DelegatedAuthEntryPoint routes AuthenticationException through
        // DefaultExceptionHandler, which answers 403 app-wide -- the same
        // expectation as ClubAdminListingIT and MyClubsIT.
        mockMvc.perform(get("/api/v1/club-creation-requests"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ official email

    @Test
    void onlyAPlatformAdminCanWriteAClubsOfficialEmail() throws Exception {
        User owner = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        makeClubOwner(createClub("robotics", "Robotics"), owner);

        // The club's own owner cannot: the address is how the club is recovered,
        // so whoever runs it today must not be able to point it at themselves.
        mockMvc.perform(patch("/api/v1/clubs/robotics/official-email")
                        .header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("officialEmail", "captured@attacker.com"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/clubs/robotics/official-email")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("officialEmail", "Robotics@Campus.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.officialEmail", is("robotics@campus.com")))
                .andExpect(jsonPath("$.officialEmailVerified", is(false)));
    }

    @Test
    void settingAnOfficialEmailNeverMarksItVerified() throws Exception {
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        createClub("robotics", "Robotics");

        // Stand in for the round trip that does not exist yet: prove the column
        // being non-null before the write is not carried over by it.
        jdbcTemplate.update(
                "UPDATE clubs SET official_email = ?, official_email_verified_at = NOW() WHERE id = ?",
                "old@campus.com", "robotics");

        mockMvc.perform(patch("/api/v1/clubs/robotics/official-email")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("officialEmail", "new@campus.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.officialEmailVerified", is(false)));

        // ADR-006: an admin correcting a typo must not inherit the proof that
        // belonged to the previous address.
        assertNull(clubRepository.findById("robotics").orElseThrow().getOfficialEmailVerifiedAt());
    }

    // ------------------------------------------------------------- the claim flow

    @Test
    void aClubBornWithAnOwnerCannotBeClaimed() throws Exception {
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(post("/api/v1/clubs")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("id", "robotics", "name", "Robotics"))))
                .andExpect(status().isOk());

        // The consequence worth pinning down: with every new club owned from
        // birth, the claim queue now applies only to clubs that never had one.
        mockMvc.perform(post("/api/v1/club-admin-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("clubId", "robotics", "message", "let me run it"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aProposalCarriesItsTaxonomyOntoTheCreatedClub() throws Exception {
        User user = createUser("Uma", "uma@campus.com", "password123", RoleName.ROLE_USER);
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        String categorySlug = jdbcTemplate.queryForObject(
                "SELECT slug FROM club_categories ORDER BY sort_order LIMIT 1", String.class);
        List<String> interests = jdbcTemplate.queryForList(
                "SELECT slug FROM interest_catalogue ORDER BY slug LIMIT 2", String.class);

        String response = mockMvc.perform(post("/api/v1/club-creation-requests")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "id", "robotics",
                                "name", "Robotics",
                                "description", "We build robots",
                                "category", categorySlug,
                                "interests", interests,
                                "message", "please"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category", is(categorySlug)))
                .andReturn().getResponse().getContentAsString();
        long requestId = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(post("/api/v1/club-creation-requests/" + requestId + "/approve")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        // The duplication ADR-005 accepts is only worth the cost if the fields
        // actually make it across.
        mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category", is(categorySlug)))
                .andExpect(jsonPath("$.interests", containsInAnyOrder(interests.toArray())));
    }
}
