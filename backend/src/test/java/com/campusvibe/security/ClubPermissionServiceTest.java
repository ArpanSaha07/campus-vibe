package com.campusvibe.security;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
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

@ExtendWith(MockitoExtension.class)
class ClubPermissionServiceTest {

    @Mock private ClubRepository clubRepository;
    @Mock private EventRepository eventRepository;

    private ClubPermissionService permissionService;

    @BeforeEach
    void setUp() {
        permissionService = new ClubPermissionService(clubRepository, eventRepository);
    }

    private User userWithRoles(long id, RoleName... roleNames) {
        User user = new User();
        user.setId(id);
        for (RoleName roleName : roleNames) {
            user.getRoles().add(new Role(roleName.name()));
        }
        return user;
    }

    private Authentication authFor(User user) {
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }

    private Club clubOwnedBy(Long userId) {
        Club club = new Club();
        club.setId("c1");
        club.setName("Club");
        club.setClubAdminId(userId);
        return club;
    }

    @Test
    void adminBypassesOwnership() {
        User admin = userWithRoles(1, RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        assertTrue(permissionService.canManageClub(authFor(admin), "any-club"));
    }

    @Test
    void clubAdminCanManageOwnedClub() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        when(clubRepository.findById("c1")).thenReturn(Optional.of(clubOwnedBy(2L)));

        assertTrue(permissionService.canManageClub(authFor(clubAdmin), "c1"));
    }

    @Test
    void clubAdminCannotManageForeignClub() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        when(clubRepository.findById("c1")).thenReturn(Optional.of(clubOwnedBy(99L)));

        assertFalse(permissionService.canManageClub(authFor(clubAdmin), "c1"));
    }

    @Test
    void clubAdminCannotManageUnownedClub() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        when(clubRepository.findById("c1")).thenReturn(Optional.of(clubOwnedBy(null)));

        assertFalse(permissionService.canManageClub(authFor(clubAdmin), "c1"));
    }

    @Test
    void plainUserCannotManageAnyClub() {
        User user = userWithRoles(3, RoleName.ROLE_USER);
        assertFalse(permissionService.canManageClub(authFor(user), "c1"));
    }

    @Test
    void missingClubIsDenied() {
        User clubAdmin = userWithRoles(2, RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        when(clubRepository.findById("nope")).thenReturn(Optional.empty());

        assertFalse(permissionService.canManageClub(authFor(clubAdmin), "nope"));
    }

    @Test
    void nullAuthenticationIsDenied() {
        assertFalse(permissionService.canManageClub(null, "c1"));
    }

    @Test
    void missingEventIsDenied() {
        User admin = userWithRoles(1, RoleName.ROLE_USER, RoleName.ROLE_CLUB_ADMIN);
        when(eventRepository.findById(5L)).thenReturn(Optional.empty());

        assertFalse(permissionService.canManageEvent(authFor(admin), 5L));
    }
}
