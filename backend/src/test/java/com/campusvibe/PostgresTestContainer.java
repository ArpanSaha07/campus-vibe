package com.campusvibe;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The PostgreSQL every integration test runs against.
 *
 * <p><strong>Why this exists.</strong> The suite used to run on H2 with
 * {@code ddl-auto: create-drop} and Flyway switched off, which meant the schema
 * under test was generated from the JPA entities and <em>nothing ever executed
 * {@code db/migrations}</em>. A migration could be invalid, ordered wrongly, or
 * contradict an entity and the whole suite still passed; the first sign of
 * trouble was a container that would not boot. It also meant no test could
 * exercise anything PostgreSQL-specific — the partial unique indexes behind the
 * one-owner invariant, and the pgvector columns behind semantic search, simply
 * were not there.
 *
 * <p><strong>Why pgvector rather than the stock postgres image.</strong> {@code V8}
 * runs {@code CREATE EXTENSION vector} and adds {@code vector(1536)} columns. On
 * plain {@code postgres:15} that migration fails and no test starts.
 * {@code asCompatibleSubstituteFor} is what lets Testcontainers accept a
 * non-canonical image for {@link PostgreSQLContainer}; it matches the image
 * {@code docker/docker-compose.yml} runs, so tests and local development are on
 * the same database.
 *
 * <p><strong>One container for the whole JVM.</strong> Started from a static
 * initialiser and never stopped: there are ten-odd IT classes, and a container
 * per class would dominate the run. Testcontainers' Ryuk sidecar removes it when
 * the JVM exits, so nothing leaks. Flyway runs once per Spring context and is
 * idempotent afterwards, so contexts sharing this container is safe.
 *
 * <p><strong>{@code SearchIT} and {@code SearchRateLimitIT} deliberately do not
 * use this — do not "consolidate" them onto it.</strong> They predate this class,
 * declare their own {@code @Container}, and depend on the eight mock clubs that
 * {@code V6__insert_mock_clubs.sql} seeds: {@code SearchIT} looks up
 * {@code chess-club}, {@code coding-club} and {@code music-ensemble} by id and
 * never creates a club itself. Every suite extending
 * {@link AbstractIntegrationTest} calls {@code clubRepository.deleteAll()} in its
 * {@code @BeforeEach}, so putting them on a shared database would delete the
 * clubs {@code SearchIT} needs and it would fail on {@code orElseThrow}. The cost
 * of the split is two extra container starts, roughly a second each.
 *
 * <p>That coupling is also why retiring {@code V6} (a known deviation in
 * {@code database-lifecycle/SKILL.md}) has to replace the seed for those two
 * classes at the same time.
 */
public final class PostgresTestContainer {

    private static final DockerImageName IMAGE = DockerImageName
            .parse("pgvector/pgvector:pg15")
            .asCompatibleSubstituteFor("postgres");

    private static final PostgreSQLContainer<?> INSTANCE =
            new PostgreSQLContainer<>(IMAGE)
                    .withDatabaseName("campusvibe")
                    .withUsername("test")
                    .withPassword("test");

    static {
        INSTANCE.start();
    }

    private PostgresTestContainer() {
    }

    /**
     * Points Spring at the container. Called from a {@code @DynamicPropertySource}
     * so the port — which Testcontainers assigns at random to avoid clashing with
     * a developer's own PostgreSQL — is resolved after the container is up.
     */
    public static void registerTo(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", INSTANCE::getJdbcUrl);
        registry.add("spring.datasource.username", INSTANCE::getUsername);
        registry.add("spring.datasource.password", INSTANCE::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}
