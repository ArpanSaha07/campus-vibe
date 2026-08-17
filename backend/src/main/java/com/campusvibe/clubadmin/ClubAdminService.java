package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;

/**
 * Reads and writes club administration assignments.
 *
 * <p>Authorisation is <em>not</em> done here — callers reach this service only
 * after {@code ClubPermissionService} has cleared them via {@code @PreAuthorize}.
 * Keeping the check at the controller boundary means there is exactly one place
 * to look to answer "who may call this", rather than a permission test buried
 * halfway down a service method.
 */
@Service
public class ClubAdminService {

    /**
     * What the Administrators tab shows: the people who can act today, plus
     * anyone invited and not yet through the door. Revoked and expired rows are
     * history and belong in the activity log, not in a list of the current team.
     */
    private static final EnumSet<AssignmentStatus> LIVE =
            EnumSet.of(AssignmentStatus.ACTIVE, AssignmentStatus.PENDING);

    private final ClubAdminAssignmentRepository assignmentRepository;

    public ClubAdminService(ClubAdminAssignmentRepository assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    /** Every club the user may manage. Empty for an ordinary member. */
    @Transactional(readOnly = true)
    public List<ManagedClubDTO> listManagedClubs(Long userId) {
        return assignmentRepository
                .findByUserIdAndStatus(userId, AssignmentStatus.ACTIVE)
                .stream()
                .map(assignment -> {
                    Club club = assignment.getClub();
                    return new ManagedClubDTO(
                            club.getId(),
                            club.getName(),
                            club.getLogo(),
                            club.getFollowers(),
                            assignment.getRole(),
                            club.getOfficialEmail(),
                            club.getOfficialEmailVerifiedAt() != null
                    );
                })
                .toList();
    }

    /**
     * The club's management team, owner first and then admins by join date.
     *
     * <p>The owner-first sort happens here rather than in the query because
     * {@code role} is stored as text: {@code ORDER BY role} would sort
     * "CLUB_ADMIN" above "CLUB_OWNER". Comparing by enum ordinal says what is
     * actually meant, and a club's exec team is small enough that ordering a
     * handful of rows in memory costs nothing.
     */
    @Transactional(readOnly = true)
    public List<ClubAdminDTO> listAdmins(String clubId) {
        return assignmentRepository
                .findByClubIdAndStatusInOrderByCreatedAtAsc(clubId, LIVE)
                .stream()
                .sorted(Comparator.comparing(ClubAdminAssignment::getRole))
                .map(ClubAdminService::toDto)
                .toList();
    }

    /**
     * Installs a club's first owner.
     *
     * <p>This is the bootstrap path from §9 of the governance doc: clubs launch
     * with nobody in charge, and a platform admin puts the first person there by
     * approving their request. Every subsequent change of hands is an ownership
     * transfer instead, which is why this refuses a club that already has an
     * owner rather than replacing them — a platform admin approving a stale
     * request must not be able to depose a sitting owner by accident.
     *
     * @param grantedByUserId the platform admin who approved, recorded for
     *                        accountability
     */
    @Transactional
    public ClubAdminAssignment assignFirstOwner(Club club, User user, Long grantedByUserId) {
        if (assignmentRepository.existsByClubIdAndRoleAndStatus(
                club.getId(), ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)) {
            throw new RequestValidationException(
                    "Club [%s] already has an owner; transfer ownership instead".formatted(club.getId()));
        }

        // The (club_id, user_id) partial unique index covers PENDING and ACTIVE
        // rows, so an existing live assignment would fail at the database with
        // a constraint violation rather than a message anyone can act on.
        if (assignmentRepository.existsByClubIdAndUserIdAndStatus(
                club.getId(), user.getId(), AssignmentStatus.ACTIVE)) {
            throw new RequestValidationException(
                    "%s already administers club [%s]".formatted(user.getEmail(), club.getId()));
        }

        ClubAdminAssignment assignment = new ClubAdminAssignment();
        assignment.setClub(club);
        assignment.setUser(user);
        assignment.setRole(ClubRole.CLUB_OWNER);
        assignment.setInvitedByUserId(grantedByUserId);
        assignment.activate();
        return assignmentRepository.save(assignment);
    }

    private static ClubAdminDTO toDto(ClubAdminAssignment assignment) {
        User user = assignment.getUser();
        return new ClubAdminDTO(
                assignment.getId(),
                user.getId(),
                user.getName(),
                user.getEmail(),
                assignment.getRole(),
                assignment.getStatus(),
                assignment.getCreatedAt(),
                assignment.getActivatedAt()
        );
    }
}
