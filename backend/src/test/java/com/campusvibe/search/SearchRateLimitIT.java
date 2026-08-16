package com.campusvibe.search;

import com.campusvibe.security.ratelimit.SearchRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The three controls added for [BUG-005]: a per-IP budget on the public search
 * endpoints, a query length cap, and a cache in front of the embedding call.
 *
 * <p>Testcontainers rather than the shared H2 profile, for the same reason
 * {@code SearchIT} does it: the search SQL is Postgres-specific and simply
 * returns 500 on H2, which would make every assertion here meaningless.
 *
 * <p>The budget is set small so the test is fast and its intent legible. The
 * cache's own behaviour is pinned by {@link QueryEmbeddingCacheTest}, which can
 * count provider calls; only the wiring is checked here.
 */
@SpringBootTest(properties = {
        "jwt.secret=test-only-secret-0123456789-0123456789-0123456789",
        // Guarantees no live OpenAI call even with OPENAI_API_KEY exported.
        "campusvibe.ai.openai.api-key=",
        "campusvibe.search.rate-limit.enabled=true",
        "campusvibe.search.rate-limit.ip-requests-per-window=4",
        "campusvibe.search.rate-limit.window=60s",
})
@AutoConfigureMockMvc
@Testcontainers
class SearchRateLimitIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private SearchRateLimitFilter filter;
    @Autowired private QueryEmbeddingCache queryEmbeddingCache;

    @BeforeEach
    void clearCounters() {
        // Both are process-wide and outlive any per-test state.
        filter.reset();
        queryEmbeddingCache.clear();
    }

    private void search(String query, int expectedStatus) throws Exception {
        mockMvc.perform(get("/api/v1/events/search").param("q", query))
                .andExpect(status().is(expectedStatus));
    }

    // --- the budget --------------------------------------------------------

    @Test
    void fifthSearchInTheWindowIs429WithRetryAfter() throws Exception {
        for (int i = 0; i < 4; i++) {
            search("chess", 200);
        }

        mockMvc.perform(get("/api/v1/events/search").param("q", "chess"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message", containsString("Too many searches")));
    }

    @Test
    void eventAndClubSearchShareOneBudget() throws Exception {
        // Both endpoints cost an embedding call, so switching between them must
        // not buy a fresh allowance.
        for (int i = 0; i < 2; i++) {
            search("chess", 200);
        }
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(get("/api/v1/clubs/search").param("q", "chess"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/v1/clubs/search").param("q", "chess"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void browsingIsNotRateLimitedBySearch() throws Exception {
        // The budget covers the endpoints that can reach the provider, and
        // nothing else. Ordinary list reads stay free.
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/v1/events")).andExpect(status().isOk());
            mockMvc.perform(get("/api/v1/clubs")).andExpect(status().isOk());
        }
    }

    @Test
    void theAuthEndpointsAreOnADifferentBudget() throws Exception {
        // Exhaust search entirely.
        for (int i = 0; i < 6; i++) {
            mockMvc.perform(get("/api/v1/events/search").param("q", "chess"));
        }

        // Auth must be unaffected: separate budget, separate reason.
        mockMvc.perform(get("/api/v1/auth/email-status").param("email", "nobody@campus.com"))
                .andExpect(status().isOk());
    }

    // --- the query length cap ----------------------------------------------

    @Test
    void anOverlongQueryIsRejectedBeforeAnyEmbeddingCall() throws Exception {
        search("a".repeat(SearchLimits.MAX_QUERY_LENGTH + 1), 400);

        // Rejected, not truncated: truncating still pays for the work, and
        // silently answers a different question than the one asked.
        assertEquals(0, queryEmbeddingCache.size(),
                "an over-length query must never reach the embedding provider");
    }

    @Test
    void aQueryExactlyAtTheCapIsAccepted() throws Exception {
        search("a".repeat(SearchLimits.MAX_QUERY_LENGTH), 200);
    }

    // --- the query embedding cache -----------------------------------------

    @Test
    void anEmptyProviderAnswerIsNotCached() throws Exception {
        // No API key here, so embed() returns empty. Caching that would pin
        // search into keyword-only mode for the whole TTL after one blip.
        search("chess club", 200);

        assertEquals(0, queryEmbeddingCache.size());
    }
}
