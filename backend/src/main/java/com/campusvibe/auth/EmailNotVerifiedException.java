package com.campusvibe.auth;

/**
 * The credentials were right but the address has never been confirmed.
 *
 * <p>Deliberately not a {@code BadCredentialsException}: mapping it to 401
 * would tell the user their password is wrong when it is not, and leave them
 * retrying it forever. Mapped to 403 with a message naming the actual problem.
 *
 * <p>Thrown from two places. At sign-in, only when
 * {@code campusvibe.auth.require-verified-email} is on, and only after the
 * password has already been proven correct — so it discloses nothing to someone
 * who does not already hold the credentials. And when answering a club
 * invitation ({@code ClubAdminService.claimableBy}), always: an invitation
 * names an address, so claiming one has to mean proving that address, whatever
 * the sign-in setting happens to be.
 */
public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
