package com.campusvibe.security;

import com.campusvibe.jwt.JWTAuthenticationFilter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityFilterChainConfig {

        private final AuthenticationProvider authenticationProvider;
    private final JWTAuthenticationFilter jwtAuthenticationFilter;
    private final AuthenticationEntryPoint authenticationEntryPoint;

    public SecurityFilterChainConfig(AuthenticationProvider authenticationProvider,
                                     JWTAuthenticationFilter jwtAuthenticationFilter,
                                     @Qualifier("delegatedAuthEntryPoint") AuthenticationEntryPoint authenticationEntryPoint) {
        this.authenticationProvider = authenticationProvider;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CSRF protection guards credentials the browser attaches on its
                // own — cookies, Basic auth. This API authenticates from an
                // Authorization header that page script has to set deliberately,
                // and a cross-site form cannot set headers, so there is nothing
                // for a token to protect. The session policy below is the other
                // half of that: with no session there is nothing to ride.
                //
                // This stops being true the moment the JWT moves to a cookie
                // ([BUG-003], the httpOnly work). Re-enable CSRF in the same
                // change — a cookie the browser sends automatically is exactly
                // the case this line assumes does not exist.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/google",
                                // The mailed token is the credential; there is
                                // no session yet to authenticate these with.
                                "/api/v1/auth/forgot-password",
                                "/api/v1/auth/reset-password",
                                "/api/v1/auth/verify-email"
                        ).permitAll()
                        // MUST precede the permitAll block below — matchers are
                        // evaluated in order and the first match wins, so
                        // "/api/v1/clubs/**" would otherwise make a club's
                        // management team public. @PreAuthorize would still
                        // refuse an anonymous caller, but as 403-from-SpEL
                        // rather than 401, and one edit to the SpEL away from
                        // leaking every administrator's name and email.
                        .requestMatchers(HttpMethod.GET, "/api/v1/clubs/*/admins").authenticated()
                        .requestMatchers(HttpMethod.GET,
                                "/ping",
                                "/actuator/**",
                                // Asked by the signup form before anyone is signed in.
                                "/api/v1/auth/email-status",
                                "/api/v1/clubs/**",
                                "/api/v1/events/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex.authenticationEntryPoint(authenticationEntryPoint));
        return http.build();
    }

}
