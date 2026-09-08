package com.campusvibe.clubadmin;

/**
 * What happened, as recorded in {@code club_audit_logs.action}.
 *
 * <p>Stored as text, so this enum and the rows already written change together:
 * renaming a constant orphans every historical entry that used the old name, and
 * an audit log whose old entries no longer decode is not an audit log. Add
 * values freely; rename them never.
 *
 * <p>Scoped to administration and ownership for now. Club-page edits and event
 * changes are the obvious next additions — §21's own UI example shows them — and
 * they arrive with {@code EventService.update}, which that work has to build
 * anyway.
 */
public enum ClubAuditAction {

    /** An address was invited to help administer the club. */
    CLUB_ADMIN_INVITED,
    /** An invitation was accepted, and authority actually began. */
    CLUB_ADMIN_ADDED,
    /** The invitee said no. */
    CLUB_ADMIN_DECLINED,
    /** An administrator was removed, or an unanswered invitation was cancelled. */
    CLUB_ADMIN_REMOVED,

    /** The owner offered the club to one of its admins. */
    OWNERSHIP_TRANSFER_REQUESTED,
    /** The successor accepted, and the club changed hands. */
    OWNERSHIP_TRANSFER_COMPLETED,
    /** The successor said no. */
    OWNERSHIP_TRANSFER_DECLINED,
    /** Withdrawn by the owner, or voided because the successor left the club. */
    OWNERSHIP_TRANSFER_CANCELLED
}
