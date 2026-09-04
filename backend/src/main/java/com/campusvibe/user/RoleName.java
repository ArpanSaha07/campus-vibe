package com.campusvibe.user;

/**
 * Platform-wide roles — properties of the account itself, carried in the JWT.
 *
 * <p>{@code ROLE_CLUB_ADMIN} was removed in V14. Managing a club is a
 * relationship with that club, not an attribute of the account, and it lives in
 * {@code club_admin_assignments} as {@link com.campusvibe.clubadmin.ClubRole}.
 * The deciding reason it could not stay even as a convenience flag: a role in
 * the token survives until the token expires, so a removed administrator would
 * keep it — see {@code ClubPermissionService}.
 */
public enum RoleName {
    ROLE_USER,
    ROLE_ADMIN
}
