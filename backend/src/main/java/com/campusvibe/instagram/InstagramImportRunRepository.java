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

public interface InstagramImportRunRepository extends JpaRepository<InstagramImportRun, Long> {

    List<InstagramImportRun> findAllByOrderByStartedAtDesc(Limit limit);

    Optional<InstagramImportRun> findFirstByOrderByStartedAtDesc();

    /** The latest run over the whole watch list; a club's single-account run is not one. */
    Optional<InstagramImportRun> findFirstBySourceIdIsNullOrderByStartedAtDesc();

    /** The latest Import now run for one account. */
    Optional<InstagramImportRun> findFirstBySourceIdOrderByStartedAtDesc(Long sourceId);

    Optional<InstagramImportRun> findFirstByIncludedPostsTrueAndStatusNotOrderByStartedAtDesc(InstagramImportRun.Status status);
}
