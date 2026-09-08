package com.campusvibe.clubadmin;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Reads and appends audit entries. There is deliberately no update or delete
 * here, and the database refuses both anyway — see the trigger in
 * {@code V17__create_club_audit_logs.sql}.
 */
public interface ClubAuditLogRepository extends JpaRepository<ClubAuditLog, Long> {

    /**
     * The first page: this club's entries, newest first.
     *
     * <p>Ordered by id rather than {@code created_at}. Two actions inside one
     * transaction share a timestamp to the microsecond, so a timestamp cursor
     * either repeats a row or skips one; the sequence gives a total order for
     * free. Hits {@code idx_club_audit_logs_club_recent}.
     */
    List<ClubAuditLog> findByClubIdOrderByIdDesc(String clubId, Limit limit);

    /** The next page — everything older than the last id the caller saw. */
    List<ClubAuditLog> findByClubIdAndIdLessThanOrderByIdDesc(
            String clubId, Long id, Limit limit);
}
