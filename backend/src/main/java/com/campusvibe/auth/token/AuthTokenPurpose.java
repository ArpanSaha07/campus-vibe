package com.campusvibe.auth.token;

/**
 * What a single-use token proves. Stored as TEXT and constrained in V11, so
 * this enum and the check constraint change together.
 */
public enum AuthTokenPurpose {
    PASSWORD_RESET,
    EMAIL_VERIFICATION
}
