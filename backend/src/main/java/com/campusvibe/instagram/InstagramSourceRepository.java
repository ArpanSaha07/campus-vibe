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

public interface InstagramSourceRepository extends JpaRepository<InstagramSource, Long> {

    Optional<InstagramSource> findByHandle(String handle);

    @EntityGraph(attributePaths = "club")
    List<InstagramSource> findByEnabledTrueOrderByPriorityAsc(Limit limit);

    /**
     * The ranked account list in CSV order, minus accounts whose club turned
     * auto-import off (enabled false on a club-linked source). A run takes the
     * first N of these, N being the admin's account count.
     */
    @EntityGraph(attributePaths = "club")
    @Query("SELECT s FROM InstagramSource s WHERE NOT (s.enabled = false AND s.club IS NOT NULL) ORDER BY s.priority ASC")
    List<InstagramSource> findRanked(Limit limit);

    /** How many ranked accounts sit ahead of this priority; under N means it is checked. */
    @Query("SELECT COUNT(s) FROM InstagramSource s WHERE s.priority < :priority AND NOT (s.enabled = false AND s.club IS NOT NULL)")
    long countRankedAhead(@Param("priority") int priority);

    /** Switches back on every account that is off but linked to no club: see InstagramSourceSeeder. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE InstagramSource s SET s.enabled = true WHERE s.enabled = false AND s.club IS NULL")
    int enableUnclaimedDisabled();

    /** Sources a club admin opted in from the dashboard; fetched on top of the cap. */
    @EntityGraph(attributePaths = "club")
    List<InstagramSource> findByEnabledTrueAndClubOptedInTrue();

    /** The source a club connected from its dashboard, if any. */
    @EntityGraph(attributePaths = "club")
    Optional<InstagramSource> findFirstByClubId(String clubId);

    @Query("SELECT COALESCE(MAX(s.priority), 0) FROM InstagramSource s")
    int maxPriority();

    @EntityGraph(attributePaths = "club")
    List<InstagramSource> findAllByOrderByPriorityAsc();

    @EntityGraph(attributePaths = "club")
    Optional<InstagramSource> findWithClubById(Long id);

    long countByEnabledTrue();

    long countByClubIsNotNull();
}
