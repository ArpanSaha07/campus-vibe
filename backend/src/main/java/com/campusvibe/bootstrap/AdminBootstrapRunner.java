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

/**
 * Grants {@code ROLE_ADMIN} to one configured account at startup.
 *
 * <p>This exists because a fresh production database has no administrator, and
 * every path that creates one — creating clubs, assigning club admins,
 * triggering {@code POST /api/v1/search/reindex} — is itself guarded by
 * {@code ROLE_ADMIN}. Without a bootstrap there is no way in.
 *
 * <p>An {@link ApplicationRunner} rather than {@code @PostConstruct}: the latter
 * can run before Flyway has finished, and on a cold start would query a
 * {@code roles} table that does not exist yet.
 *
 * <p><b>It never revokes.</b> If the configured address later changes, the
 * previous administrator keeps the role. Removing it here would silently lock
 * people out of production on an unrelated configuration change; revocation is
 * a deliberate manual act.
 *
 * <p>Deliberately not profile-gated — the first administrator is needed in
 * production most of all. The {@code enabled} flag is the only switch.
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
        if (!properties.enabled()) {
            return;
        }
        String email = normalise(properties.email());
        if (email == null || email.isBlank()) {
            log.warn("Admin bootstrap is enabled but APP_BOOTSTRAP_ADMIN_EMAIL is blank; skipping");
            return;
        }

        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createAdminAccount(email));
        if (user == null) {
            return; // absent account and no password — already logged
        }

        if (user.hasRole(RoleName.ROLE_ADMIN)) {
            log.info("Admin bootstrap: {} already holds ROLE_ADMIN; nothing to do", email);
            return;
        }

        user.addRole(role(RoleName.ROLE_ADMIN));
        userRepository.save(user);
        // Logged so the elevation is auditable. The address is not a secret;
        // the password never appears here under any branch.
        log.info("Admin bootstrap: granted ROLE_ADMIN to {}", email);
    }

    /**
     * Creates the account only when a password was supplied. Returning null
     * means "stop" — a password-less local account cannot be signed into, but
     * would occupy the address and block the real sign-up.
     */
    private User createAdminAccount(String email) {
        String password = properties.password();
        if (password == null || password.isBlank()) {
            log.warn("Admin bootstrap: no account exists for {} and no password was supplied. "
                            + "Sign up through the application first, then restart to be promoted.",
                    email);
            return null;
        }
        User user = new User();
        user.setName(properties.name());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setAuthProvider(AuthProvider.LOCAL);
        // The address is asserted by whoever set the environment variable, not
        // proven by a mailed link. Marked verified so the account can sign in
        // even where campusvibe.auth.require-verified-email is turned on.
        user.setEmailVerified(true);
        user.addRole(role(RoleName.ROLE_USER));
        log.info("Admin bootstrap: created account {}", email);
        return userRepository.save(user);
    }

    private Role role(RoleName roleName) {
        return roleRepository.findByName(roleName.name())
                .orElseThrow(() -> new IllegalStateException(
                        "%s is missing from the roles table; check Flyway migration V7"
                                .formatted(roleName.name())));
    }

    /** Matches AuthenticationService.normalise, or a capitalised address here would never match. */
    private static String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
