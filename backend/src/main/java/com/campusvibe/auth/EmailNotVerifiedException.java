package com.campusvibe.auth;

/**
 * The credentials were right but the address has never been confirmed.
 *
 * <p>Deliberately not a {@code BadCredentialsException}: mapping it to 401
 * would tell the user their password is wrong when it is not, and leave them
 * retrying it forever. Mapped to 403 with a message naming the actual problem.
 * Only ever thrown when {@code campusvibe.auth.require-verified-email} is on,
 * and only after the password has already been proven correct — so it discloses
 * nothing to someone who does not already hold the credentials.
 */
public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
