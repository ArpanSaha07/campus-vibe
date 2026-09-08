package com.campusvibe.security;

import com.campusvibe.clubadmin.AssignmentStatus;
import com.campusvibe.clubadmin.ClubAdminAssignmentRepository;
import com.campusvibe.clubadmin.ClubRole;
import com.campusvibe.event.EventRepository;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Club-scoped authorisation, used from {@code @PreAuthorize} SpEL:
 * {@code @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")}
 *
 * <p><strong>Every answer comes from the database, never from the token.</strong>
 * That is not a stylistic preference. Roles are copied into the JWT when it is
 * issued, so an administrator removed from a club would keep the claim until
 * their token expired — they would go on editing events for hours after being
 * removed. Reading {@code club_admin_assignments} per request costs one indexed
 * existence check and makes revocation effective on the next call
 * (club_admin_governance.md §28).
 *
 * <p>Platform {@code ROLE_ADMIN} bypasses club scope entirely. That claim
 * <em>is</em> read from the token, which is fine: it describes the account
 * rather than a relationship, and it is granted and revoked deliberately by a
 * human, not by the club lifecycle.
 */
@Service("clubPermissionService")
public class ClubPermissionService {

    private final ClubAdminAssignmentRepository assignmentRepository;
    private final EventRepository eventRepository;

    public ClubPermissionService(ClubAdminAssignmentRepository assignmentRepository,
                                 EventRepository eventRepository) {
        this.assignmentRepository = assignmentRepository;
        this.eventRepository = eventRepository;
    }

    /**
     * May this user manage the club's page and events? True for an active
     * owner, an active admin, or a platform admin.
     *
     * <p>An admin of club A gets false for club B — the assignment is looked up
     * for this exact {@code clubId}, so holding authority somewhere is never
     * authority everywhere (§24).
     */
    @Transactional(readOnly = true)
    public boolean canManageClub(Authentication authentication, String clubId) {
        User user = principalOf(authentication);
        if (user == null || clubId == null) {
            return false;
        }
        if (user.hasRole(RoleName.ROLE_ADMIN)) {
            return true;
        }
        return assignmentRepository.existsByClubIdAndUserIdAndStatus(
                clubId, user.getId(), AssignmentStatus.ACTIVE);
    }

    /**
     * May this user administer the club's <em>people</em> — invite admins,
     * remove them, transfer ownership? Owner only, plus platform admins.
     *
     * <p>The separation from {@link #canManageClub} is what stops a single
     * compromised club-admin account from taking the club over (§37): they can
     * edit an event, but they cannot add themselves an accomplice or lock the
     * owner out.
     */
    @Transactional(readOnly = true)
    public boolean isClubOwner(Authentication authentication, String clubId) {
        User user = principalOf(authentication);
        if (user == null || clubId == null) {
            return false;
        }
        if (user.hasRole(RoleName.ROLE_ADMIN)) {
            return true;
        }
        return assignmentRepository.existsByClubIdAndUserIdAndRoleAndStatus(
                clubId, user.getId(), ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE);
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

    /**
     * Anonymous requests arrive with the String {@code "anonymousUser"} as the
     * principal, so this returns null rather than throwing on a public path
     * that happens to run a permission check.
     */
    private User principalOf(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return null;
        }
        return user;
    }
}
