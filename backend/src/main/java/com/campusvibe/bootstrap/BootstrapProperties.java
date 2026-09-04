package com.campusvibe.bootstrap;

<<<<<<< HEAD
/**
 * Initial-administrator bootstrap settings, driven entirely by environment
 * variables so that no address, password or account ever reaches Git.
 *
 * <p>Two modes, both idempotent:
 * <ul>
 *   <li><b>Promote</b> — the account already exists, from sign-up or Google
 *       sign-in, so only the role grant is needed. This is the normal case, and
 *       the only one available for a Google account, which has no password.</li>
 *   <li><b>Create, then promote</b> — only when the address is unknown
 *       <em>and</em> a password is supplied.</li>
 * </ul>
 *
 * @param enabled  master switch. False (the default) makes
 *                 {@link AdminBootstrapRunner} a no-op. Set it back to false in
 *                 production once the administrator exists, so a restart never
 *                 re-runs account creation.
 * @param email    address to elevate. Blank is treated as disabled. Normalised
 *                 the same way sign-up normalises it — trimmed and lowercased —
 *                 because otherwise a capitalised value here would fail to match
 *                 the stored row and silently create a duplicate account.
 * @param password used <em>only</em> when the account must be created. Leave it
 *                 unset to promote an existing account. A blank password never
 *                 produces a password-less account; the runner refuses instead,
 *                 because such an account could not be signed into but would
 *                 occupy the address.
 * @param name     display name for a newly created account, ignored when
 *                 promoting. {@code users} has a single {@code name} column, so
 *                 there is deliberately no first/last split here.
 */
@org.springframework.boot.context.properties.ConfigurationProperties(prefix = "app.bootstrap.admin")
public record BootstrapProperties(
        boolean enabled,
        String email,
        String password,
        String name
) {
    public BootstrapProperties {
        if (name == null || name.isBlank()) name = "Administrator";
=======
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
>>>>>>> 7fc77e8b4ea47594d1d054eea7c3b408717fd448
    }
}
