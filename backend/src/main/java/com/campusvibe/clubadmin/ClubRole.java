package com.campusvibe.clubadmin;

/**
 * A user's authority over one specific club.
 *
 * <p>Deliberately only two values. Granular club permissions — event manager,
 * communications, treasurer — are a stated non-goal
 * (club_admin_governance.md §43): they multiply the authorisation surface
 * without matching how student clubs actually delegate, which is informally and
 * by trust rather than by capability grant.
 *
 * <p>These are <em>not</em> {@link com.campusvibe.user.RoleName} values. Those
 * describe the account platform-wide and land in the JWT; these describe one
 * relationship and are read from the database on every request.
 */
public enum ClubRole {
    /** Exactly one active per club. Adds administrator and ownership control. */
    CLUB_OWNER,
    /** Any number per club. Manages the club page and its events. */
    CLUB_ADMIN
}
