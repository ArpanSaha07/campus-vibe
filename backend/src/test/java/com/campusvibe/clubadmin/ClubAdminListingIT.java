package com.campusvibe.clubadmin;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The Administrators tab and the managed-clubs picker — MVP items 3 and 4 of
 * the governance doc — plus the database invariants they rest on.
 */
class ClubAdminListingIT extends AbstractIntegrationTest {

    @Autowired private ClubAdminService clubAdminService;

    @Test
    void adminsListShowsOwnerFirstThenAdmins() throws Exception {
        Club club = createClub("robotics", "Robotics");
        User owner = createUser("Sarah", "sarah@campus.com", "password123", RoleName.ROLE_USER);
        User michael = createUser("Michael", "michael@campus.com", "password123", RoleName.ROLE_USER);
        User emma = createUser("Emma", "emma@campus.com", "password123", RoleName.ROLE_USER);
        makeClubAdmin(club, michael);
        makeClubAdmin(club, emma);
        makeClubOwner(club, owner);

        mockMvc.perform(get("/api/v1/clubs/robotics/admins")
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                // CLUB_OWNER precedes CLUB_ADMIN in the enum, so ordering by
                // role puts the owner at the top regardless of join date.
                .andExpect(jsonPath("$[0].role", is("CLUB_OWNER")))
                .andExpect(jsonPath("$[0].userName", is("Sarah")))
                .andExpect(jsonPath("$[1].role", is("CLUB_ADMIN")))
                .andExpect(jsonPath("$[1].userName", is("Michael")))
                .andExpect(jsonPath("$[2].userName", is("Emma")));
    }

    /** §3.2: admins may see who their co-administrators are. */
    @Test
    void clubAdminMayReadTheAdminsList() throws Exception {
        Club club = createClub("chess", "Chess");
        User owner = createUser("Owner", "o@campus.com", "password123", RoleName.ROLE_USER);
        User helper = createUser("Helper", "h@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        makeClubAdmin(club, helper);

        mockMvc.perform(get("/api/v1/clubs/chess/admins")
                        .header("Authorization", bearer(helper)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void outsiderCannotReadTheAdminsList() throws Exception {
        Club club = createClub("fencing", "Fencing");
        User owner = createUser("Owner", "o2@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        User outsider = createUser("Nosy", "nosy@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/clubs/fencing/admins")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
    }

    /**
     * GET /api/v1/clubs/** is permitAll, so this pins the explicit
     * authenticated() matcher that pulls /admins back out of the public set.
     * Without it the club's roster of names and emails would be world-readable.
     */
    @Test
    void anonymousCannotReadTheAdminsList() throws Exception {
        Club club = createClub("judo", "Judo");
        User owner = createUser("Owner", "o3@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);

        // 403 rather than 401: DelegatedAuthEntryPoint routes
        // AuthenticationException through DefaultExceptionHandler, which answers
        // 403 app-wide. Same expectation as MyClubsIT and MyEventsIT.
        mockMvc.perform(get("/api/v1/clubs/judo/admins"))
                .andExpect(status().isForbidden());
    }

    @Test
    void platformAdminMayReadAnyClubsAdmins() throws Exception {
        Club club = createClub("rowing", "Rowing");
        User owner = createUser("Owner", "o4@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        User platformAdmin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        mockMvc.perform(get("/api/v1/clubs/rowing/admins")
                        .header("Authorization", bearer(platformAdmin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    /** One user, several clubs — the case the old one-club model could not express. */
    @Test
    void managedClubsListsEveryClubWithTheRoleHeldInEach() throws Exception {
        Club owned = createClub("owned-club", "Owned Club");
        Club helped = createClub("helped-club", "Helped Club");
        createClub("unrelated-club", "Unrelated Club");
        User user = createUser("Multi", "multi@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(owned, user);
        makeClubAdmin(helped, user);

        mockMvc.perform(get("/api/v1/users/me/managed-clubs")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[?(@.clubId == 'owned-club')].role", contains("CLUB_OWNER")))
                .andExpect(jsonPath("$[?(@.clubId == 'helped-club')].role", contains("CLUB_ADMIN")))
                .andExpect(jsonPath("$[?(@.clubId == 'unrelated-club')]", hasSize(0)));
    }

    /** "You manage nothing" is a normal answer, not a 403. */
    @Test
    void managedClubsIsEmptyForAnOrdinaryMember() throws Exception {
        createClub("some-club", "Some Club");
        User user = createUser("Plain", "plain@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(get("/api/v1/users/me/managed-clubs")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void managedClubsRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/managed-clubs"))
                .andExpect(status().isForbidden());
    }

    /*
     * The two guards below sit at different layers and both matter.
     *
     * The service check is the one users hit, and it produces a message they
     * can act on. The partial unique index is the backstop for a bug or a race
     * that gets past it — a club left with zero or two owners cannot be
     * repaired by the club itself, so the invariant is worth stating twice.
     *
     * The index tests could not run at all until the suite moved onto real
     * PostgreSQL: H2 has no partial indexes, and with Flyway disabled the
     * migration never executed anyway.
     */

    /** §9 at the service layer: a second owner is refused with a usable message. */
    @Test
    void serviceRefusesASecondOwner() {
        Club club = createClub("sailing", "Sailing");
        User first = createUser("First", "first@campus.com", "password123", RoleName.ROLE_USER);
        User second = createUser("Second", "second@campus.com", "password123", RoleName.ROLE_USER);
        clubAdminService.assignFirstOwner(club, first, null);

        RequestValidationException thrown = assertThrows(RequestValidationException.class,
                () -> clubAdminService.assignFirstOwner(club, second, null));
        assertTrue(thrown.getMessage().contains("already has an owner"));

        ClubAdminAssignment owner = clubAdminAssignmentRepository
                .findByClubIdAndRoleAndStatus("sailing", ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)
                .orElseThrow();
        assertEquals(first.getId(), owner.getUser().getId());
    }

    /**
     * Revoked rows stay, and the same person can be brought back afterwards —
     * the reason the uniqueness rule covers PENDING and ACTIVE only rather than
     * being a plain UNIQUE (club_id, user_id).
     */
    @Test
    void revokedAdminKeepsTheirHistoryAndCanBeReinstated() {
        Club club = createClub("hiking", "Hiking");
        User owner = createUser("Owner", "o5@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        User member = createUser("Member", "m@campus.com", "password123", RoleName.ROLE_USER);
        ClubAdminAssignment first = makeClubAdmin(club, member);

        first.revoke(owner.getId());
        clubAdminAssignmentRepository.saveAndFlush(first);

        // Revoked grants nothing, and drops out of the live team listing.
        assertFalse(clubAdminAssignmentRepository.existsByClubIdAndUserIdAndStatus(
                "hiking", member.getId(), AssignmentStatus.ACTIVE));
        assertEquals(1, clubAdminService.listAdmins("hiking").size());

        makeClubAdmin(club, member);

        assertTrue(clubAdminAssignmentRepository.existsByClubIdAndUserIdAndStatus(
                "hiking", member.getId(), AssignmentStatus.ACTIVE));
        assertEquals(2, clubAdminService.listAdmins("hiking").size());
        // Both rows survive: the revocation is still on the record.
        assertEquals(2, clubAdminAssignmentRepository.findAll().stream()
                .filter(a -> a.getUser().getId().equals(member.getId()))
                .count());
        assertEquals(owner.getId(), first.getRevokedByUserId());
    }

    /**
     * The database backstop: {@code one_active_owner_per_club}, a partial unique
     * index on {@code (club_id) WHERE role = 'CLUB_OWNER' AND status = 'ACTIVE'}.
     *
     * <p>Written against the repository rather than the service on purpose —
     * this must fail even when the service-layer check is bypassed, because a
     * race between two approvals would do exactly that.
     */
    @Test
    void databaseRefusesASecondActiveOwner() {
        Club club = createClub("sailing-db", "Sailing");
        User first = createUser("First", "first-db@campus.com", "password123", RoleName.ROLE_USER);
        User second = createUser("Second", "second-db@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, first);

        assertThrows(DataIntegrityViolationException.class, () -> {
            makeClubOwner(club, second);
            clubAdminAssignmentRepository.flush();
        });
    }

    /**
     * A revoked owner row must not block the next owner — which is why the index
     * is partial on {@code status = 'ACTIVE'} rather than a plain
     * {@code UNIQUE (club_id) WHERE role = 'CLUB_OWNER'}. Without the status
     * predicate, every ownership transfer after the first would fail.
     */
    @Test
    void databaseAllowsANewOwnerOnceTheOldRowIsRevoked() {
        Club club = createClub("rowing-db", "Rowing");
        User outgoing = createUser("Out", "out-db@campus.com", "password123", RoleName.ROLE_USER);
        User incoming = createUser("In", "in-db@campus.com", "password123", RoleName.ROLE_USER);
        ClubAdminAssignment previous = makeClubOwner(club, outgoing);

        previous.revoke(outgoing.getId());
        clubAdminAssignmentRepository.saveAndFlush(previous);

        assertDoesNotThrow(() -> {
            makeClubOwner(club, incoming);
            clubAdminAssignmentRepository.flush();
        });
    }

    /**
     * The second partial index, {@code one_live_assignment_per_club_user}: one
     * PENDING-or-ACTIVE row per person per club, so an invitation cannot be sent
     * to someone who already holds a live assignment.
     */
    @Test
    void databaseRefusesTwoLiveAssignmentsForOneUser() {
        Club club = createClub("hiking-db", "Hiking");
        User owner = createUser("Owner", "owner-db@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        User member = createUser("Member", "member-db@campus.com", "password123", RoleName.ROLE_USER);
        makeClubAdmin(club, member);

        assertThrows(DataIntegrityViolationException.class, () -> {
            makeClubAdmin(club, member);
            clubAdminAssignmentRepository.flush();
        });
    }

    /**
     * Every migration in db/migrations actually ran, against the real engine.
     * This is the check the suite had no way to make while it was on H2 — the
     * one that would have caught V12 failing to apply.
     */
    @Test
    void flywayAppliedTheClubGovernanceMigrations() {
        List<String> applied = jdbcTemplate.queryForList(
                "select version from flyway_schema_history where success order by installed_rank",
                String.class);

        assertTrue(applied.containsAll(List.of("12", "13", "14", "15")),
                "expected V12-V15 to be applied, got " + applied);
    }

    /** The pgvector extension V8 needs. Absent on H2, so this never held before. */
    @Test
    void pgvectorExtensionIsInstalled() {
        Integer installed = jdbcTemplate.queryForObject(
                "select count(*) from pg_extension where extname = 'vector'", Integer.class);
        assertEquals(1, installed);
    }
}
