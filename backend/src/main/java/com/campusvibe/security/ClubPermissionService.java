package com.campusvibe.security;

import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.EventRepository;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ownership checks for club-scoped resources, used from @PreAuthorize SpEL:
 * {@code @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")}
 *
 * Admins bypass ownership; club admins must own the specific club.
 * Ownership is always checked against the database, never the token.
 */
@Service("clubPermissionService")
public class ClubPermissionService {

    private final ClubRepository clubRepository;
    private final EventRepository eventRepository;

    public ClubPermissionService(ClubRepository clubRepository, EventRepository eventRepository) {
        this.clubRepository = clubRepository;
        this.eventRepository = eventRepository;
    }

    public boolean canManageClub(Authentication authentication, String clubId) {
        User user = principalOf(authentication);
        if (user == null) {
            return false;
        }
        if (user.hasRole(RoleName.ROLE_ADMIN)) {
            return true;
        }
        if (!user.hasRole(RoleName.ROLE_CLUB_ADMIN)) {
            return false;
        }
        return clubRepository.findById(clubId)
                .map(club -> user.getId().equals(club.getClubAdminId()))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean canManageEvent(Authentication authentication, Long eventId) {
        User user = principalOf(authentication);
        if (user == null) {
            return false;
        }
        if (user.hasRole(RoleName.ROLE_ADMIN)) {
            return true;
        }
        return eventRepository.findById(eventId)
                .map(event -> canManageClub(authentication, event.getOrganizer().getId()))
                .orElse(false);
    }

    private User principalOf(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return null;
        }
        return user;
    }
}
