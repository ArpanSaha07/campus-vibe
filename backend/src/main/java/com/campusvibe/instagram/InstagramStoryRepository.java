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

public interface InstagramStoryRepository extends JpaRepository<InstagramStory, Long> {

    boolean existsBySourceIdAndExternalId(Long sourceId, String externalId);

    /** Stories a previous run stored but could not read, still worth a retry. */
    @Query("""
            select s from InstagramStory s join fetch s.source
            where s.status in (com.campusvibe.instagram.InstagramStory.Status.PENDING,
                               com.campusvibe.instagram.InstagramStory.Status.FAILED)
              and s.attemptCount < :maxAttempts
              and s.imageKey is not null
              and s.fetchedAt > :since
            order by s.fetchedAt asc
            """)
    List<InstagramStory> findRetryable(@Param("maxAttempts") int maxAttempts, @Param("since") Instant since, Limit limit);
}
