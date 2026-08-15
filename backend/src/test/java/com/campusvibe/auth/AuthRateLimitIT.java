package com.campusvibe.auth;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.security.ratelimit.AuthRateLimiter;
import com.campusvibe.user.RoleName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Rate limiting and account lockout.
 *
 * <p>Runs with its own properties — the shared test profile disables the
 * limiter, because the rest of the suite makes failed sign-in attempts on
 * purpose and would otherwise lock itself out. The small numbers here keep the
 * test fast and its intent legible.
 */
@TestPropertySource(properties = {
        "campusvibe.auth.rate-limit.enabled=true",
        "campusvibe.auth.rate-limit.ip-requests-per-window=5",
        "campusvibe.auth.rate-limit.window=60s",
        "campusvibe.auth.rate-limit.max-failed-logins=3",
        "campusvibe.auth.rate-limit.lockout-duration=15m",
})
class AuthRateLimitIT extends AbstractIntegrationTest {

    @Autowired private AuthRateLimiter rateLimiter;

    @BeforeEach
    void clearCounters() {
        // Counters are process-wide and outlive the per-test database reset.
        rateLimiter.reset();
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    private void attemptLogin(String email, String password, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", password))))
                .andExpect(status().is(expectedStatus));
    }

    // --- per-IP budget -----------------------------------------------------

    @Test
    void sixthRequestInTheWindowIs429WithRetryAfter() throws Exception {
        // Budget is 5. Use email-status, which needs no account to exist.
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message", containsString("Too many attempts")));
    }

    @Test
    void theBudgetIsSharedAcrossTheAuthEndpoints() throws Exception {
        // Three enumeration probes plus two registration attempts is five; the
        // sixth request is refused whichever endpoint it lands on. An attacker
        // must not be able to reset their budget by switching endpoint.
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                    .andExpect(status().isOk());
        }
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("name", "N", "email", "dup" + i + "@campus.com",
                                    "password", "password123"))))
                    .andExpect(status().isOk());
        }

        attemptLogin("someone@campus.com", "password123", 429);
    }

    @Test
    void authenticatedEndpointsAreNotRateLimited() throws Exception {
        // The limiter guards the unauthenticated surface. A signed-in user
        // making ordinary requests must never be throttled by it.
        var user = createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);
        for (int i = 0; i < 12; i++) {
            mockMvc.perform(get("/api/v1/users/me").header("Authorization", bearer(user)))
                    .andExpect(status().isOk());
        }
    }

    // --- per-account lockout ----------------------------------------------

    @Test
    void accountLocksAfterThreeFailuresAndSaysHowLong() throws Exception {
        createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);

        for (int i = 0; i < 3; i++) {
            attemptLogin("ann@campus.com", "wrong-password", 401);
        }

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "ann@campus.com", "password", "wrong-password"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "900"));
    }

    @Test
    void aLockedAccountIsRefusedEvenWithTheRightPassword() throws Exception {
        createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);

        for (int i = 0; i < 3; i++) {
            attemptLogin("ann@campus.com", "wrong-password", 401);
        }

        // This is the whole point: guessing must not be rescued by eventually
        // guessing right.
        attemptLogin("ann@campus.com", "password123", 429);
    }

    @Test
    void aSuccessfulLoginClearsTheFailureCount() throws Exception {
        createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);

        attemptLogin("ann@campus.com", "wrong-password", 401);
        attemptLogin("ann@campus.com", "wrong-password", 401);
        attemptLogin("ann@campus.com", "password123", 200);

        // Two more failures would have locked the account had the count carried
        // over; it did not, so they are merely 401s.
        attemptLogin("ann@campus.com", "wrong-password", 401);
        attemptLogin("ann@campus.com", "wrong-password", 401);
    }

    @Test
    void lockoutIsPerAccountNotGlobal() throws Exception {
        createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);
        createUser("Ben", "ben@campus.com", "password123", RoleName.ROLE_USER);

        for (int i = 0; i < 3; i++) {
            attemptLogin("ann@campus.com", "wrong-password", 401);
        }

        // Ben is unaffected by Ann being locked.
        attemptLogin("ben@campus.com", "password123", 200);
    }

    @Test
    void failuresAgainstAnUnknownAddressCountToo() throws Exception {
        // Counting only real accounts would make them distinguishable by
        // whether the response ever becomes a 429 — reinstating, through the
        // limiter, the enumeration the identical 401 exists to prevent.
        for (int i = 0; i < 3; i++) {
            attemptLogin("ghost@campus.com", "wrong-password", 401);
        }

        attemptLogin("ghost@campus.com", "wrong-password", 429);
    }

    @Test
    void lockoutIsCaseInsensitiveOnEmail() throws Exception {
        createUser("Ann", "ann@campus.com", "password123", RoleName.ROLE_USER);

        for (int i = 0; i < 3; i++) {
            attemptLogin("ANN@Campus.com", "wrong-password", 401);
        }

        // Varying the capitalisation must not buy a fresh allowance.
        attemptLogin("ann@campus.com", "wrong-password", 429);
    }
}
