package com.campusvibe.clubadmin;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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

    /** The club's single active owner, if it has one yet. */
    Optional<ClubAdminAssignment> findByClubIdAndRoleAndStatus(
            String clubId, ClubRole role, AssignmentStatus status);

    boolean existsByClubIdAndRoleAndStatus(String clubId, ClubRole role, AssignmentStatus status);
}
