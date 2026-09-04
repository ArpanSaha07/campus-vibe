package com.campusvibe.clubadmin;

/**
 * Lifecycle of a {@link ClubAdminAssignment}.
 *
 * <p>Only {@link #ACTIVE} grants authority. The other three exist so that the
 * history of who could manage a club, and when, survives — a removed
 * administrator leaves a REVOKED row rather than vanishing
 * (club_admin_governance.md §7).
 */
public enum AssignmentStatus {
    /** Invited, not yet accepted. Grants nothing. */
    PENDING,
    /** The only status that confers club-management authority. */
    ACTIVE,
    /** Deliberately removed. Kept for the audit trail. */
    REVOKED,
    /** An invitation that ran out of time. Grants nothing, ever. */
    EXPIRED
}
