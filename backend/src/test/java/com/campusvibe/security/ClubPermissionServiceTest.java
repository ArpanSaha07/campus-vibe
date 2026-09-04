package com.campusvibe.security;

import com.campusvibe.clubadmin.AssignmentStatus;
import com.campusvibe.clubadmin.ClubAdminAssignmentRepository;
import com.campusvibe.clubadmin.ClubRole;
import com.campusvibe.event.EventRepository;
import com.campusvibe.user.Role;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * Authority now comes from a club_admin_assignments lookup rather than from a
 * ROLE_CLUB_ADMIN claim plus a clubs.club_admin_id comparison, so these tests
 * stub the assignment repository. The behaviour they pin down is unchanged in
 * spirit and stricter in fact: no role on the account grants club access.
 */
@ExtendWith(MockitoExtension.class)
class ClubPermissionServiceTest {

    @Mock private ClubAdminAssignmentRepository assignmentRepository;
    @Mock private EventRepository eventRepository;

    private ClubPermissionService permissionService;

    @BeforeEach
    void setUp() {
        permissionService = new ClubPermissionService(assignmentRepository, eventRepository);
    }

    private User userWithRoles(long id, RoleName... roleNames) {
        User user = new User();
        user.setId(id);
        for (RoleName roleName : roleNames) {
            user.addRole(new Role(roleName.name()));
        }
        return user;
    }

    private Authentication authFor(User user) {
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }

    private void givenActiveAssignment(String clubId, long userId, boolean exists) {
        when(assignmentRepository.existsByClubIdAndUserIdAndStatus(
                clubId, userId, AssignmentStatus.ACTIVE)).thenReturn(exists);
    }

    @Test
    void adminBypassesClubScope() {
        User admin = userWithRoles(1, RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        assertTrue(permissionService.canManageClub(authFor(admin), "any-club"));
    }

    @Test
    void activeAssignmentCanManageThatClub() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER);
        givenActiveAssignment("c1", 2L, true);

        assertTrue(permissionService.canManageClub(authFor(clubAdmin), "c1"));
    }

    /** The rule from §24: authority somewhere is never authority everywhere. */
    @Test
    void assignmentInOneClubDoesNotReachAnother() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER);
        givenActiveAssignment("c2", 2L, false);

        assertFalse(permissionService.canManageClub(authFor(clubAdmin), "c2"));
    }

    /**
     * The regression this whole change exists to prevent: a revoked assignment
     * must stop working at once, even though the user's JWT is untouched.
     */
    @Test
    void revokedAssignmentLosesAccessImmediately() {
        User formerAdmin = userWithRoles(2, RoleName.ROLE_USER);
        givenActiveAssignment("c1", 2L, false); // the row is now REVOKED

        assertFalse(permissionService.canManageClub(authFor(formerAdmin), "c1"));
    }

    @Test
    void plainUserCannotManageAnyClub() {
        User user = userWithRoles(3, RoleName.ROLE_USER);
        givenActiveAssignment("c1", 3L, false);

        assertFalse(permissionService.canManageClub(authFor(user), "c1"));
    }

    @Test
    void nullAuthenticationIsDenied() {
        assertFalse(permissionService.canManageClub(null, "c1"));
    }

    @Test
    void nullClubIdIsDenied() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER);
        assertFalse(permissionService.canManageClub(authFor(clubAdmin), null));
    }

    @Test
    void ownerPassesTheOwnerCheck() {
        User owner = userWithRoles(4, RoleName.ROLE_USER);
        when(assignmentRepository.existsByClubIdAndUserIdAndRoleAndStatus(
                "c1", 4L, ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)).thenReturn(true);

        assertTrue(permissionService.isClubOwner(authFor(owner), "c1"));
    }

    /**
     * The §37 separation: a club admin can edit the club but cannot touch its
     * people, so a single compromised admin account cannot take the club over.
     */
    @Test
    void clubAdminCanManageClubButIsNotOwner() {
        User clubAdmin = userWithRoles(5, RoleName.ROLE_USER);
        givenActiveAssignment("c1", 5L, true);
        when(assignmentRepository.existsByClubIdAndUserIdAndRoleAndStatus(
                "c1", 5L, ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)).thenReturn(false);

        assertTrue(permissionService.canManageClub(authFor(clubAdmin), "c1"));
        assertFalse(permissionService.isClubOwner(authFor(clubAdmin), "c1"));
    }

    @Test
    void platformAdminIsTreatedAsOwner() {
        User admin = userWithRoles(1, RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        assertTrue(permissionService.isClubOwner(authFor(admin), "any-club"));
    }

    @Test
    void missingEventIsDenied() {
        User user = userWithRoles(1, RoleName.ROLE_USER);
        when(eventRepository.findById(5L)).thenReturn(Optional.empty());

        assertFalse(permissionService.canManageEvent(authFor(user), 5L));
    }
}
