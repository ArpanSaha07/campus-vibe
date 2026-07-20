package com.campusvibe.search;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventRepository;
import com.campusvibe.jwt.JWTUtil;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.RoleRepository;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs against real Postgres + pgvector (Testcontainers), with Flyway applying
 * V1..V8 — so this also verifies the whole migration chain. Embeddings come
 * from a deterministic stub that maps concept words onto shared dimensions,
 * which makes semantic matching testable without OpenAI: "machine learning"
 * and "AI" land on the same dimension despite sharing no keywords.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SearchIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg15").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    static final AtomicBoolean EMBEDDINGS_ENABLED = new AtomicBoolean(true);

    @TestConfiguration
    static class StubEmbeddingConfig {

        static final Map<String, Integer> CONCEPT_DIMENSIONS = Map.ofEntries(
                Map.entry("ai", 0), Map.entry("artificial", 0), Map.entry("intelligence", 0),
                Map.entry("machine", 0), Map.entry("learning", 0),
                Map.entry("chess", 1), Map.entry("strategy", 1), Map.entry("board", 1),
                Map.entry("music", 2), Map.entry("concert", 2), Map.entry("jam", 2));

        @Bean
        @Primary
        EmbeddingService stubEmbeddingService() {
            return new EmbeddingService() {
                @Override
                public boolean isEnabled() {
                    return EMBEDDINGS_ENABLED.get();
                }

                @Override
                public Optional<float[]> embed(String text) {
                    if (!isEnabled() || text == null || text.isBlank()) {
                        return Optional.empty();
                    }
                    float[] vector = new float[1536];
                    for (String token : text.toLowerCase(Locale.ROOT).split("\\W+")) {
                        if (token.isBlank()) {
                            continue;
                        }
                        // Concept words share a dimension (that's the "semantics");
                        // every other token gets its own hashed dimension so that
                        // unrelated texts stay near-orthogonal.
                        Integer dim = CONCEPT_DIMENSIONS.get(token);
                        int index = dim != null ? dim : 100 + Math.floorMod(token.hashCode(), 1400);
                        vector[index] += 1f;
                    }
                    double norm = 0;
                    for (float v : vector) {
                        norm += v * v;
                    }
                    if (norm == 0) {
                        return Optional.empty();
                    }
                    for (int i = 0; i < vector.length; i++) {
                        vector[i] /= (float) Math.sqrt(norm);
                    }
                    return Optional.of(vector);
                }
            };
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired EventRepository eventRepository;
    @Autowired ClubRepository clubRepository;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JWTUtil jwtUtil;
    @Autowired SearchIndexService searchIndexService;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void reset() {
        EMBEDDINGS_ENABLED.set(true);
        eventRepository.deleteAll();
    }

    private Event createIndexedEvent(String title, String description, String organizerId) {
        Event event = new Event();
        event.setTitle(title);
        event.setDescription(description);
        event.setDateTime(Instant.now().plusSeconds(86400));
        event.setOrganizer(clubRepository.findById(organizerId).orElseThrow());
        Event saved = eventRepository.save(event);
        searchIndexService.indexEvent(saved);
        return saved;
    }

    @Test
    void semanticSearchMatchesMeaningWithoutSharedKeywords() throws Exception {
        Event aiEvent = createIndexedEvent(
                "AI Networking Night", "Meet artificial intelligence researchers", "coding-club");
        createIndexedEvent("Weekly Tournament", "Bring your own board and strategy", "chess-club");

        // "machine learning" shares no words with the AI event, only meaning
        mockMvc.perform(get("/api/v1/events/search").param("q", "machine learning"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(aiEvent.getId().intValue())))
                .andExpect(jsonPath("$[0].title", is("AI Networking Night")));
    }

    @Test
    void keywordLegStillMatchesWhenSemanticsDoNot() throws Exception {
        createIndexedEvent("AI Networking Night", "Meet artificial intelligence researchers", "coding-club");
        Event tournament = createIndexedEvent(
                "Weekly Tournament", "Bring your own board and strategy", "chess-club");

        // "tournament" is not a known concept for the stub -> semantic score ~0,
        // so only the keyword leg can (and must) surface it
        mockMvc.perform(get("/api/v1/events/search").param("q", "tournament"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(tournament.getId().intValue())));
    }

    @Test
    void semanticallyClosestResultRanksFirst() throws Exception {
        Event aiEvent = createIndexedEvent(
                "AI Networking Night", "Meet artificial intelligence researchers", "coding-club");
        Event chessEvent = createIndexedEvent(
                "Strategy Night", "chess and board games", "chess-club");

        mockMvc.perform(get("/api/v1/events/search").param("q", "chess"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is(chessEvent.getId().intValue())))
                .andExpect(jsonPath("$[*].id", not(hasItem(aiEvent.getId().intValue()))));
    }

    @Test
    void fallsBackToKeywordSearchWhenEmbeddingsDisabled() throws Exception {
        Event event = createIndexedEvent("Jazz Concert", "Live music on campus", "music-ensemble");
        EMBEDDINGS_ENABLED.set(false);

        mockMvc.perform(get("/api/v1/events/search").param("q", "concert"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(event.getId().intValue())));

        // partial title match works without full-text hit
        mockMvc.perform(get("/api/v1/events/search").param("q", "Jazz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void clubSearchFindsSeededClubs() throws Exception {
        clubRepository.findAll().forEach(searchIndexService::indexClub);

        mockMvc.perform(get("/api/v1/clubs/search").param("q", "programmers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is("coding-club")));
    }

    @Test
    void blankQueryReturnsEmptyList() throws Exception {
        mockMvc.perform(get("/api/v1/events/search").param("q", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void reindexBackfillsMissingEmbeddingsAndRequiresAdmin() throws Exception {
        EMBEDDINGS_ENABLED.set(false);
        createIndexedEvent("AI Workshop", "hands on machine learning", "coding-club"); // not embedded
        assertEquals(0, countEmbeddedEvents());

        EMBEDDINGS_ENABLED.set(true);
        mockMvc.perform(post("/api/v1/search/reindex").header("Authorization", bearerFor(adminUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.embeddingsEnabled", is(true)))
                .andExpect(jsonPath("$.eventsIndexed", is(1)));
        assertEquals(1, countEmbeddedEvents());

        mockMvc.perform(post("/api/v1/search/reindex").header("Authorization", bearerFor(plainUser())))
                .andExpect(status().isForbidden());
    }

    private int countEmbeddedEvents() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM events WHERE embedding IS NOT NULL", Integer.class);
        return count == null ? 0 : count;
    }

    private User adminUser() {
        return userWithRoles("search-admin@campus.com", RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
    }

    private User plainUser() {
        return userWithRoles("search-user@campus.com", RoleName.ROLE_USER);
    }

    private User userWithRoles(String email, RoleName... roleNames) {
        return userRepository.findByEmail(email).orElseGet(() -> {
            User user = new User();
            user.setName(email);
            user.setEmail(email);
            user.setPassword(passwordEncoder.encode("password123"));
            for (RoleName roleName : roleNames) {
                user.getRoles().add(roleRepository.findByName(roleName.name()).orElseThrow());
            }
            return userRepository.save(user);
        });
    }

    private String bearerFor(User user) {
        return "Bearer " + jwtUtil.issueToken(user.getId(), user.getEmail(), user.getRoleNames());
    }
}
