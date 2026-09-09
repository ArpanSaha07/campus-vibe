package com.campusvibe.clubadmin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ClubCreationRequestRepository extends JpaRepository<ClubCreationRequest, Long> {

    List<ClubCreationRequest> findByStatusOrderByRequestedAtAsc(RequestStatus status);

    List<ClubCreationRequest> findAllByOrderByRequestedAtAsc();

    boolean existsByUserIdAndStatus(Long userId, RequestStatus status);

    /**
     * The slug reservation, read before the insert so the second requester gets
     * a sentence rather than a constraint violation.
     *
     * <p>Lower-cased on both sides to match {@code one_pending_proposal_per_slug},
     * which indexes {@code lower(proposed_slug)}. The index is still the
     * authority — this check races, and losing it means a
     * {@code DataIntegrityViolationException} rather than a duplicate row.
     */
    @Query("SELECT COUNT(r) > 0 FROM ClubCreationRequest r "
            + "WHERE LOWER(r.proposedSlug) = LOWER(:slug) AND r.status = :status")
    boolean existsPendingForSlug(String slug, RequestStatus status);
}
