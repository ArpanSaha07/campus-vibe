package com.campusvibe.bootstrap;

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
    }
}
