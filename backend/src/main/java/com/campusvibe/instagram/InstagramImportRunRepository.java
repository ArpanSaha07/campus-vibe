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

    Optional<InstagramImportRun> findFirstByIncludedPostsTrueAndStatusNotOrderByStartedAtDesc(InstagramImportRun.Status status);
}
