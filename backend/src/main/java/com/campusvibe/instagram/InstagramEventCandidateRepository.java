package com.campusvibe.instagram;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InstagramEventCandidateRepository extends JpaRepository<InstagramEventCandidate, Long> {

    @EntityGraph(attributePaths = {"story", "source", "source.club"})
    List<InstagramEventCandidate> findByStatusInOrderByCreatedAtDesc(
            Collection<InstagramEventCandidate.Status> statuses, Limit limit);

    /** One candidate with what its DTO reads, so mapping needs no open session. */
    @EntityGraph(attributePaths = {"story", "source", "source.club"})
    Optional<InstagramEventCandidate> findWithDetailsById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InstagramEventCandidate c where c.id = :id")
    Optional<InstagramEventCandidate> findByIdForUpdate(@Param("id") Long id);

    /** Live candidates near a start time, for duplicate detection. */
    @Query("""
            select c from InstagramEventCandidate c join fetch c.story
            where c.dateTime between :from and :to
              and c.status in (com.campusvibe.instagram.InstagramEventCandidate.Status.PENDING_REVIEW,
                               com.campusvibe.instagram.InstagramEventCandidate.Status.PUBLISHED)
            """)
    List<InstagramEventCandidate> findLiveBetween(@Param("from") Instant from, @Param("to") Instant to);

    long countByStatus(InstagramEventCandidate.Status status);
}
