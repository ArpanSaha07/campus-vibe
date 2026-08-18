package com.campusvibe.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How the first platform administrator comes into existence.
 *
 * <p>Environment variables rather than committed configuration, because the one
 * value that matters is a real person's email address and the other is a
 * password. Neither belongs in a file that is checked in.
 *
 * @param enabled  master switch. False — the default — makes the runner a no-op,
 *                 which is what every environment that already has its admins
 *                 should be running with. It is not enough to unset the address:
 *                 an explicit switch makes "bootstrap is off" a thing you can
 *                 read in the environment rather than infer from an absence.
 * @param email    the account to elevate. Matched case-insensitively, the way
 *                 every other address lookup in the application is.
 * @param password used <em>only</em> when no account with that address exists
 *                 yet. Leave it blank when the account is already there — which
 *                 is the normal case, and the only one that works for an account
 *                 created through Google, which has no password at all.
 */
@ConfigurationProperties(prefix = "campusvibe.bootstrap.admin")
public record BootstrapProperties(
        boolean enabled,
        String email,
        String password
) {

    /** True when there is an address to act on at all. */
    public boolean isConfigured() {
        return enabled && email != null && !email.isBlank();
    }

    public boolean hasPassword() {
        return password != null && !password.isBlank();
    }
}
