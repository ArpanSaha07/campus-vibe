package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.user.User;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The one place club audit entries are written, per §35.
 *
 * <p>Scattered inserts were the alternative and are worse in a specific way:
 * they drift. Each call site decides for itself what to put in metadata, so six
 * months later the same action reads three different ways depending on which
 * one produced it, and changing that means finding every site again. One method
 * means one shape.
 *
 * <p><strong>Writes join the caller's transaction.</strong> {@code record} has
 * no {@code REQUIRES_NEW}, so an entry is committed exactly when the action it
 * describes is. §26 puts the audit write inside the transfer transaction for
 * this reason: an action that happened without being logged is a hole in the
 * record, and one logged without happening is a lie. The cost is that a bug here
 * can fail a user action, which is the right way round for a governance log.
 */
@Service
public class ClubAuditService {

    /** Bounded so a caller cannot ask for the whole table in one request. */
    private static final int MAX_PAGE = 100;
    private static final int DEFAULT_PAGE = 25;

    private final ClubAuditLogRepository repository;

    public ClubAuditService(ClubAuditLogRepository repository) {
        this.repository = repository;
    }

    /**
     * Appends an entry.
     *
     * <p>The actor is taken from the authenticated {@link User}, never from a
     * request body (§22) — a client-supplied actor is a signature anyone can
     * forge. The name is copied rather than referenced so the line still reads
     * after the account is renamed or deleted.
     */
    @Transactional
    public void record(String clubId, User actor, ClubAuditAction action,
                       AuditEntityType entityType, String entityId,
                       Map<String, String> metadata) {
        ClubAuditLog entry = new ClubAuditLog();
        entry.setClubId(clubId);
        entry.setActorUserId(actor == null ? null : actor.getId());
        entry.setActorName(actor == null ? "CampusVibe" : actor.getName());
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setMetadata(metadata == null || metadata.isEmpty() ? null : metadata);
        repository.save(entry);
    }

    /** Convenience for an entry about a club administration assignment. */
    @Transactional
    public void recordAssignment(Club club, User actor, ClubAuditAction action,
                                 ClubAdminAssignment assignment, Map<String, String> metadata) {
        record(club.getId(), actor, action, AuditEntityType.CLUB_ADMIN_ASSIGNMENT,
                assignment.getId() == null ? null : String.valueOf(assignment.getId()),
                metadata);
    }

    /** Convenience for an entry about an ownership handover. */
    @Transactional
    public void recordTransfer(Club club, User actor, ClubAuditAction action,
                               ClubOwnershipTransfer transfer, Map<String, String> metadata) {
        record(club.getId(), actor, action, AuditEntityType.CLUB_OWNERSHIP_TRANSFER,
                transfer.getId() == null ? null : String.valueOf(transfer.getId()),
                metadata);
    }

    /**
     * A page of a club's history, newest first.
     *
     * @param before the smallest id the caller has already seen, or null for the
     *               first page. A keyset cursor rather than an offset: entries
     *               are appended constantly, and an offset silently repeats a
     *               row every time one arrives between two page requests.
     */
    @Transactional(readOnly = true)
    public List<ClubAuditLogDTO> page(String clubId, Long before, Integer limit) {
        Limit size = Limit.of(clampLimit(limit));
        List<ClubAuditLog> rows = before == null
                ? repository.findByClubIdOrderByIdDesc(clubId, size)
                : repository.findByClubIdAndIdLessThanOrderByIdDesc(clubId, before, size);
        return rows.stream().map(ClubAuditService::toDto).toList();
    }

    private static int clampLimit(Integer requested) {
        if (requested == null || requested < 1) return DEFAULT_PAGE;
        return Math.min(requested, MAX_PAGE);
    }

    /**
     * Builds a metadata map from alternating key/value pairs, skipping any pair
     * whose value is null.
     *
     * <p>Null-skipping matters: an invitation to an address with no account has
     * no target name, and a map containing {@code "targetName": null} would make
     * every consumer check for it. Absent is easier to render than present-but-
     * empty.
     */
    public static Map<String, String> metadata(String... keyValuePairs) {
        if (keyValuePairs.length % 2 != 0) {
            throw new IllegalArgumentException("metadata takes key/value pairs");
        }
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValuePairs.length; i += 2) {
            String value = keyValuePairs[i + 1];
            if (value != null && !value.isBlank()) {
                map.put(keyValuePairs[i], value);
            }
        }
        return map;
    }

    private static ClubAuditLogDTO toDto(ClubAuditLog entry) {
        return new ClubAuditLogDTO(
                entry.getId(),
                entry.getAction(),
                entry.getEntityType(),
                entry.getEntityId(),
                entry.getActorUserId(),
                entry.getActorName(),
                entry.getMetadata(),
                entry.getCreatedAt()
        );
    }
}
