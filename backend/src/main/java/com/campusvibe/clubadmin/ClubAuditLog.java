package com.campusvibe.clubadmin;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * One thing that happened to a club, recorded as it happened.
 *
 * <p><strong>Append-only, and the database enforces it.</strong> A
 * {@code BEFORE UPDATE OR DELETE} trigger raises an exception, so there is no
 * code path — including a future one somebody adds without reading this — that
 * can edit or remove an entry. §22 asks for exactly that, and the person most
 * motivated to add a delete is the person the rule constrains.
 *
 * <p><strong>Nothing here is a foreign key.</strong> Not the club, not the
 * actor. A foreign key would make the history only as durable as the thing it
 * describes, and a club being deleted is the moment its history is most worth
 * keeping. The names are snapshots for the same reason: the entry has to still
 * read correctly after the account is gone or renamed.
 *
 * <p>Written only through {@code ClubAuditService}, per §35 — scattered inserts
 * drift in what they record and are impossible to change consistently later.
 */
@Entity
@Table(name = "club_audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class ClubAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "club_id", nullable = false)
    private String clubId;

    /** Null only for an action with no club administrator behind it. */
    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "actor_name", nullable = false)
    private String actorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClubAuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false)
    private AuditEntityType entityType;

    /** Text because entity ids here are a mix of numeric and slug. */
    @Column(name = "entity_id")
    private String entityId;

    /**
     * Whatever the entry needs to render itself — the other person's name, what
     * the outgoing owner chose. Snapshotted, never joined.
     *
     * <p>{@code Map<String, String>} rather than a free-form object so that
     * every value is something already safe to display. §20 forbids secrets and
     * tokens here, and a narrow type makes it harder to put one in by accident.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> metadata;

    /**
     * Server time, set here and never accepted from a caller (§22). A client
     * clock is not evidence of anything.
     */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
