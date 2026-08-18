package com.campusvibe;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.clubadmin.ClubAdminAssignment;
import com.campusvibe.clubadmin.ClubAdminAssignmentRepository;
import com.campusvibe.clubadmin.ClubAdminRequestRepository;
import com.campusvibe.clubadmin.ClubOwnershipTransferRepository;
import com.campusvibe.clubadmin.ClubRole;
import com.campusvibe.event.EventRepository;
import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

/**
 * Base class for every {@code *IT} suite.
 *
 * <p>These run against a real PostgreSQL (pgvector) container with Flyway
 * enabled and {@code ddl-auto: validate} — see {@link PostgresTestContainer} for
 * why, and {@code src/test/resources/application-it.yml} for what that changes.
 * Requires a working Docker daemon; the fast {@code *Test} unit suites do not
 * and still run on H2.
 *
 * <p>Profiles are ordered: {@code test} supplies the shared test configuration
 * (mock S3, disabled rate limits, throwaway JWT secret) and {@code it} overrides
 * its H2-specific half.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "it"})
public abstract class AbstractIntegrationTest {

    @DynamicPropertySource
    static void datasourceFromContainer(DynamicPropertyRegistry registry) {
        PostgresTestContainer.registerTo(registry);
    }

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JWTUtil jwtUtil;
    @Autowired protected RoleRepository roleRepository;
    @Autowired protected UserRepository userRepository;
    @Autowired protected ClubRepository clubRepository;
    @Autowired protected EventRepository eventRepository;
    @Autowired protected ClubAdminRequestRepository clubAdminRequestRepository;
    @Autowired protected ClubAdminAssignmentRepository clubAdminAssignmentRepository;
    @Autowired protected ClubOwnershipTransferRepository clubOwnershipTransferRepository;
    @Autowired protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetDatabaseAndSeedRoles() {
        // Transfers and assignments hold FKs to both clubs and users, so they
        // go first. Transfers before assignments only for readability -- they
        // reference no assignment -- but keeping the order 'most dependent
        // first' means a new table can be added at the top without thought.
        clubOwnershipTransferRepository.deleteAll();
        clubAdminAssignmentRepository.deleteAll();
        clubAdminRequestRepository.deleteAll();
        eventRepository.deleteAll();
        clubRepository.deleteAll();
        userRepository.deleteAll();
        for (RoleName roleName : RoleName.values()) {
            roleRepository.findByName(roleName.name())
                    .orElseGet(() -> roleRepository.save(new Role(roleName.name())));
        }
    }

    protected User createUser(String name, String email, String rawPassword, RoleName... roleNames) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        for (RoleName roleName : roleNames) {
            user.addRole(roleRepository.findByName(roleName.name()).orElseThrow());
        }
        return userRepository.save(user);
    }

    /**
     * An account created through Google: no password, provider GOOGLE. The
     * V10 check constraint rejects any other combination, so this is the only
     * shape a Google row can legally take.
     */
    protected User createGoogleUser(String name, String email, RoleName... roleNames) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(null);
        user.setAuthProvider(AuthProvider.GOOGLE);
        for (RoleName roleName : roleNames) {
            user.addRole(roleRepository.findByName(roleName.name()).orElseThrow());
        }
        return userRepository.save(user);
    }

    protected Club createClub(String id, String name) {
        Club club = new Club();
        club.setId(id);
        club.setName(name);
        return clubRepository.save(club);
    }

    /**
     * Grants club-scoped authority directly, bypassing the invitation flow.
     *
     * <p>Tests that care about <em>reaching</em> a club-management endpoint use
     * this to arrange the world; tests of how authority is <em>acquired</em> go
     * through the real request or invitation endpoints instead.
     */
    protected ClubAdminAssignment grantClubRole(Club club, User user, ClubRole role) {
        ClubAdminAssignment assignment = new ClubAdminAssignment();
        assignment.setClub(club);
        assignment.setUser(user);
        assignment.setRole(role);
        assignment.activate();
        return clubAdminAssignmentRepository.save(assignment);
    }

    protected ClubAdminAssignment makeClubOwner(Club club, User user) {
        return grantClubRole(club, user, ClubRole.CLUB_OWNER);
    }

    protected ClubAdminAssignment makeClubAdmin(Club club, User user) {
        return grantClubRole(club, user, ClubRole.CLUB_ADMIN);
    }

    protected String tokenFor(User user) {
        return jwtUtil.issueToken(user.getId(), user.getEmail(), user.getRoleNames());
    }

    protected String bearer(User user) {
        return "Bearer " + tokenFor(user);
    }

    protected static Set<String> roleNamesOf(User user) {
        return Set.copyOf(user.getRoleNames());
    }
}
