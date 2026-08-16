package com.campusvibe.user;

/**
 * How an account was created, and therefore how it can be signed into.
 *
 * <p>Stored as TEXT in {@code users.auth_provider} (V10) and constrained there,
 * so this enum and the database check constraint must be changed together.
 *
 * <p>Deliberately a single column rather than a {@code user_identities} table:
 * one account has exactly one origin today. Adding a third provider (Facebook
 * is queued) is the point at which that stops being true, because the same
 * person may then arrive by two routes — that migration is the natural time to
 * split this out.
 */
public enum AuthProvider {
    /** Email and password. {@code users.password} holds a bcrypt hash. */
    LOCAL,
    /** Google Identity Services. {@code users.password} is NULL. */
    GOOGLE
}
