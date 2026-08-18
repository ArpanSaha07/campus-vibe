package com.campusvibe.clubadmin;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ClubAdminAssignmentRepository extends JpaRepository<ClubAdminAssignment, Long> {

    /**
     * The authorisation query, run on every club-scoped request. Deliberately
     * an existence check against the FK column: it touches the partial index on
     * {@code (user_id) WHERE status = 'ACTIVE'} and loads no entity.
     */
    boolean existsByClubIdAndUserIdAndStatus(String clubId, Long userId, AssignmentStatus status);

    boolean existsByClubIdAndUserIdAndRoleAndStatus(
            String clubId, Long userId, ClubRole role, AssignmentStatus status);

    Optional<ClubAdminAssignment> findByClubIdAndUserIdAndStatus(
            String clubId, Long userId, AssignmentStatus status);

    /**
     * Every club this user currently manages, with the clubs joined in — this
     * backs the dashboard's club picker, where fetching lazily would issue one
     * query per club.
     */
    @EntityGraph(attributePaths = "club")
    List<ClubAdminAssignment> findByUserIdAndStatus(Long userId, AssignmentStatus status);

    /**
     * The Administrators tab. Takes a set of statuses rather than one because
     * the tab shows the live team — active administrators plus invitations
     * still outstanding — and those are two statuses, not one.
     *
     * <p>Users are joined in because the list renders names and emails; without
     * the graph this is a textbook N+1.
     *
     * <p>Ordered by join date only. Putting the owner first is deliberately
     * <em>not</em> done here: {@code role} is {@code @Enumerated(STRING)}, so
     * {@code ORDER BY role} sorts the text, and "CLUB_ADMIN" precedes
     * "CLUB_OWNER" alphabetically — the exact opposite of the intended display
     * order. {@code ClubAdminService} sorts by enum ordinal instead.
     */
    @EntityGraph(attributePaths = "user")
    List<ClubAdminAssignment> findByClubIdAndStatusInOrderByCreatedAtAsc(
            String clubId, Collection<AssignmentStatus> statuses);

    /**
     * Is there already a live assignment for this user in this club? Takes a
     * set of statuses because "live" is PENDING or ACTIVE, and an invitation
     * still outstanding must block a second one just as an active role does.
     * This is the check {@code one_live_assignment_per_club_user} enforces;
     * asking first is what turns a constraint violation into a sentence.
     */
    boolean existsByClubIdAndUserIdAndStatusIn(
            String clubId, Long userId, Collection<AssignmentStatus> statuses);

    /** The same question for an address that may not have an account yet. */
    boolean existsByClubIdAndInvitedEmailIgnoreCaseAndStatusIn(
            String clubId, String invitedEmail, Collection<AssignmentStatus> statuses);

    /**
     * Every invitation waiting on this person, matched two ways at once.
     *
     * <p>An invitation sent before the invitee had an account carries only the
     * address; one sent afterwards also carries the resolved user id. Both are
     * theirs, and the invitee's screen must show both, so this cannot be keyed
     * on either column alone.
     *
     * <p>{@code a.user.id} reads the foreign key without joining {@code users};
     * the club is fetched because every row renders a club name and logo.
     */
    @EntityGraph(attributePaths = "club")
    @Query("""
            SELECT a FROM ClubAdminAssignment a
            WHERE a.status = :status
              AND (a.user.id = :userId OR LOWER(a.invitedEmail) = LOWER(:email))
            ORDER BY a.createdAt ASC
            """)
    List<ClubAdminAssignment> findInvitationsFor(
            @Param("userId") Long userId,
            @Param("email") String email,
            @Param("status") AssignmentStatus status);

    /** The club's single active owner, if it has one yet. */
    Optional<ClubAdminAssignment> findByClubIdAndRoleAndStatus(
            String clubId, ClubRole role, AssignmentStatus status);

    boolean existsByClubIdAndRoleAndStatus(String clubId, ClubRole role, AssignmentStatus status);
}
