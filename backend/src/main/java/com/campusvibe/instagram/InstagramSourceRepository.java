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

    @EntityGraph(attributePaths = "club")
    List<InstagramSource> findAllByOrderByPriorityAsc();

    @EntityGraph(attributePaths = "club")
    Optional<InstagramSource> findWithClubById(Long id);

    long countByEnabledTrue();

    long countByClubIsNotNull();
}
