package com.campusvibe.security;

import com.campusvibe.security.ratelimit.RateLimitProperties;
import com.campusvibe.security.ratelimit.SearchRateLimitProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
 

@Configuration
@EnableConfigurationProperties({RateLimitProperties.class, SearchRateLimitProperties.class})
public class SecurityConfig {

    /**
     * bcrypt cost factor, pinned rather than left to the library default.
     *
     * <p>It is a security parameter, and an implicit one changes underneath you
     * on a dependency bump — in either direction. Ten is the current Spring
     * Security default and meets the usual guidance; it is written down here so
     * that a change is a decision with a diff rather than a side effect.
     *
     * <p>Raising it is safe for existing accounts: a bcrypt hash records the
     * cost it was made with, so old hashes keep verifying at their old cost.
     * They do <b>not</b> re-hash on next login — that would need a
     * {@code DelegatingPasswordEncoder} and an upgrade-on-authentication hook,
     * which is not wired up. Raising it also makes every login slower by
     * design, so measure before moving it.
     */
    private static final int BCRYPT_COST = 10;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCRYPT_COST);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        return new ProviderManager(authenticationProvider(userDetailsService, passwordEncoder));
    }

    @Bean
    public EmailPasswordAuthenticationProvider authenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        return new EmailPasswordAuthenticationProvider(userDetailsService, passwordEncoder);
    }

}
