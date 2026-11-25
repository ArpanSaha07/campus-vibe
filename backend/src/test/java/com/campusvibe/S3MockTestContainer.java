package com.campusvibe;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * The object store every integration test runs against.
 *
 * <p><strong>Why this exists.</strong> The suite used to run against a
 * filesystem stub, which meant the {@code S3Client} branch that production uses
 * had never executed anywhere — not in a test, not in CI, not on a laptop.
 * Everything real S3 has and a stub does not was untested by construction, and
 * the stub had a vulnerability S3 does not have, because it joined the key onto
 * a directory where {@code ..} climbs (BUG-039). S3Mock speaks the S3 HTTP API,
 * so the real client still runs from a test to production with only its
 * endpoint changed (ADR-011, kept by ADR-026).
 *
 * <p><strong>Why S3Mock and not MinIO.</strong> MinIO's images stopped pulling
 * without a login and upstream archived the project, so CI lost every IT
 * (BUG-063). ADR-026 weighs the alternatives; the cost it accepts is that this
 * is a test double, so a behaviour where real S3 and S3Mock differ shows only in
 * production.
 *
 * <p><strong>One container for the whole JVM</strong>, started from a static
 * initialiser and never stopped, exactly as {@link PostgresTestContainer} is
 * and for the same reason: a container per IT class would dominate the run.
 * Testcontainers' Ryuk sidecar removes it when the JVM exits.
 *
 * <p><strong>One bucket, created by S3Mock itself</strong> from
 * {@code COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS}, the same way
 * {@code docker/docker-compose.yml} gets its bucket, so no client is needed
 * here before Spring starts. The name is arbitrary — production's is
 * {@code campusvibe-prod-media} — because what is asserted is the key layout
 * inside it, which is what ADR-012 separates media kinds by.
 *
 * <p><strong>Credentials are placeholders.</strong> S3Mock does not check
 * signatures (it answered unsigned requests when probed 2026-11-25), but
 * {@code S3Config} requires static credentials whenever an endpoint is set,
 * so the client is given some.
 */
public final class S3MockTestContainer {

    /**
     * Docker Hub, verified publisher, pulled anonymously the way a CI runner
     * does. Pinned to an exact version, never {@code latest}, and the same tag
     * {@code docker/docker-compose.yml} runs so a test and a local stack are the
     * same store (ADR-026).
     */
    private static final String S3MOCK_IMAGE = "adobe/s3mock:5.2.3";

    private static final String ACCESS_KEY = "campusvibe-test";
    private static final String SECRET_KEY = "campusvibe-test-secret";
    private static final String BUCKET = "campusvibe-test-media";
    private static final String REGION = "ca-central-1";
    private static final int API_PORT = 9090;

    private static final GenericContainer<?> INSTANCE =
            new GenericContainer<>(DockerImageName.parse(S3MOCK_IMAGE))
                    .withEnv("COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS", BUCKET)
                    .withExposedPorts(API_PORT)
                    // Waits on the bucket rather than on the root: it answers
                    // 200 only once the API is up and the bucket exists, which
                    // is the state every IT assumes. Waiting on a log line
                    // would tie the suite to a release's startup banner.
                    .waitingFor(Wait.forHttp("/" + BUCKET).forPort(API_PORT).forStatusCode(200));

    static {
        INSTANCE.start();
    }

    private S3MockTestContainer() {
    }

    private static String endpoint() {
        return "http://" + INSTANCE.getHost() + ":" + INSTANCE.getMappedPort(API_PORT);
    }

    /**
     * Points Spring at the container. Called from a {@code @DynamicPropertySource}
     * so the port — which Testcontainers assigns at random — is resolved after
     * the container is up, and so these outrank {@code application-test.yml}.
     */
    public static void registerTo(DynamicPropertyRegistry registry) {
        registry.add("aws.region", () -> REGION);
        registry.add("aws.s3.bucket", () -> BUCKET);
        registry.add("aws.s3.endpoint", S3MockTestContainer::endpoint);
        registry.add("aws.s3.access-key", () -> ACCESS_KEY);
        registry.add("aws.s3.secret-key", () -> SECRET_KEY);
    }
}
