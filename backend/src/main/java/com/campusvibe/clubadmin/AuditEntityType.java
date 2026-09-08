package com.campusvibe.clubadmin;

/**
 * What kind of thing an audit entry is about, per §20.
 *
 * <p>Paired with {@code entity_id} so an entry can be traced back to the row it
 * describes. Kept separate from {@link ClubAuditAction} because the same entity
 * has several things that can happen to it, and reading "which assignment did
 * this concern" should not mean parsing an action name.
 */
public enum AuditEntityType {
    CLUB,
    EVENT,
    CLUB_ADMIN_ASSIGNMENT,
    CLUB_OWNERSHIP_TRANSFER
}
