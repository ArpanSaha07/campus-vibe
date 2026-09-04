package com.campusvibe.clubadmin;

import java.time.Instant;
import java.util.Map;

/**
 * One line of a club's Activity tab.
 *
 * <p>Readable by the club's whole management team, per §19 and §30 — an admin
 * who cannot see what changed cannot notice a change they did not expect, which
 * is most of what an audit log is for.
 *
 * <p>Carries the raw {@code action} and {@code metadata} rather than a rendered
 * sentence. The wording belongs in the frontend beside the rest of the copy, and
 * a server that shipped English strings would have to be redeployed to fix a
 * typo.
 */
public record ClubAuditLogDTO(
        Long id,
        ClubAuditAction action,
        AuditEntityType entityType,
        String entityId,
        /** Null if the entry predates the account, or the account is gone. */
        Long actorUserId,
        /** The actor's name as it was when this happened. */
        String actorName,
        Map<String, String> metadata,
        Instant createdAt
) {}
