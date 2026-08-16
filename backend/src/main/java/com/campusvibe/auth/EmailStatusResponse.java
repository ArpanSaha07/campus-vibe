package com.campusvibe.auth;

/**
 * Whether an email already has an account, and how that account signs in.
 *
 * @param exists   true if an account exists for the address
 * @param provider {@code LOCAL} or {@code GOOGLE} when it exists, else null
 */
public record EmailStatusResponse(
        boolean exists,
        String provider
) {}
