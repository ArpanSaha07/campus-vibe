package com.campusvibe.bootstrap;

import com.campusvibe.user.AuthProvider;
import com.campusvibe.user.Role;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.RoleRepository;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

/**
 * Gives one account {@code ROLE_ADMIN} at startup, so a system with no
 * administrators can acquire its first one.
 *
 * <p>Every administrative path in the application is behind
 * {@code hasRole('ADMIN')} — creating clubs, approving the club-admin requests
 * that install a club's first owner, reindexing search. Until an admin exists,
 * none of them can be reached by anybody, and there is no bootstrap endpoint
 * because an unauthenticated way to mint an administrator is precisely the
 * thing that must not exist.
 *
 * <p><strong>An {@link ApplicationRunner}, never {@code @PostConstruct}.</strong>
 * A {@code @PostConstruct} on a bean can fire before Flyway has finished, and
 * this touches {@code users} and {@code roles} — on a cold start against an
 * empty database that is a race with the migration that creates them. Runners
 * execute after the context is fully refreshed, which is after Flyway.
 *
 * <p><strong>Not gated on a profile.</strong> The first administrator has to
 * come from somewhere in production too, and that is the environment where
 * reaching for {@code psql} is least appropriate. It is gated on
 * {@code campusvibe.bootstrap.admin.enabled}, which defaults to false, so an
 * environment that has not asked for this gets a single skipped check at boot
 * and nothing else. Tests are unaffected for the same reason.
 *
 * <p><strong>It grants and never revokes.</strong> Removing {@code ROLE_ADMIN}
 * from accounts the variable no longer names would mean that editing one
 * environment variable — or losing it, or a typo in it — silently locks the
 * administrators out of a running production system on the next deploy. Taking
 * an administrator's access away is a deliberate act and belongs somewhere a
 * human has to mean it.
 */
@Component
@EnableConfigurationProperties(BootstrapProperties.class)
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final BootstrapProperties properties;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminBootstrapRunner(BootstrapProperties properties,
                                UserRepository userRepository,
                                RoleRepository roleRepository,
                                PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.isConfigured()) {
            log.debug("Admin bootstrap is off (campusvibe.bootstrap.admin.enabled)");
            return;
        }

        String email = properties.email().trim().toLowerCase(Locale.ROOT);

        Optional<User> existing = userRepository.findByEmail(email);
        User admin = existing.orElse(null);

        if (admin == null) {
            if (!properties.hasPassword()) {
                // Deliberately a warning and a return rather than an exception.
                // Refusing to start would take a working application down over
                // a misconfigured convenience, and creating the account without
                // a password would leave an ADMIN row that nothing can sign in
                // to but that a later password-reset request could claim.
                log.warn("Admin bootstrap: no account for [{}] and no password set, so nothing was done. "
                        + "Either sign that address up first, or set APP_BOOTSTRAP_ADMIN_PASSWORD.", email);
                return;
            }
            admin = createAccount(email);
            log.info("Admin bootstrap: created account [{}]", email);
        }

        if (admin.hasRole(RoleName.ROLE_ADMIN)) {
            // The common case on every restart after the first. Logged at info
            // because the interesting question when reading a boot log is
            // usually "did this run and what did it decide", not "did it
            // change anything".
            log.info("Admin bootstrap: [{}] already holds ROLE_ADMIN, nothing to do", email);
            return;
        }

        admin.addRole(adminRole());
        userRepository.save(admin);

        // Logged, and deliberately naming the address: elevating an account to
        // full platform administration is exactly the kind of event that should
        // be answerable from a boot log months later.
        log.info("Admin bootstrap: granted ROLE_ADMIN to [{}]", email);
    }

    /**
     * Creates the account, for the case where the address has never signed up.
     *
     * <p>Hashed with the same encoder the real sign-up path uses, so the
     * resulting row is indistinguishable from one made through the product —
     * anything else would be an account that only this code could produce and
     * only this code would understand.
     */
    private User createAccount(String email) {
        User user = new User();
        user.setName("CampusVibe Admin");
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(properties.password()));
        user.setAuthProvider(AuthProvider.LOCAL);
        // The address was supplied by whoever controls the environment, which
        // is a stronger claim than a confirmation link proves.
        user.setEmailVerified(true);
        user.addRole(roleRepository.findByName(RoleName.ROLE_USER.name())
                .orElseThrow(() -> new IllegalStateException(
                        "ROLE_USER is missing; V7 should have created it")));
        return userRepository.save(user);
    }

    private Role adminRole() {
        return roleRepository.findByName(RoleName.ROLE_ADMIN.name())
                .orElseThrow(() -> new IllegalStateException(
                        "ROLE_ADMIN is missing; V7 should have created it"));
    }
}
