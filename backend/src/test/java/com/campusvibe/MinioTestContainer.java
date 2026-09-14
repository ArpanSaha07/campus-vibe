package com.campusvibe;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;

import java.net.URI;

/**
 * The object store every integration test runs against.
 *
 * <p><strong>Why this exists.</strong> The suite used to run against a
 * filesystem stub, which meant the {@link S3Client} branch that production uses
 * had never executed anywhere — not in a test, not in CI, not on a laptop.
 * Everything real S3 has and a stub does not was untested by construction, and
 * the stub had a vulnerability S3 does not have, because it joined the key onto
 * a directory where {@code ..} climbs (BUG-039). MinIO
 * speaks S3, so there is now one code path from a test to production
 * (ADR-011).
 *
 * <p><strong>One container for the whole JVM</strong>, started from a static
 * initialiser and never stopped, exactly as {@link PostgresTestContainer} is
 * and for the same reason: a container per IT class would dominate the run.
 * Testcontainers' Ryuk sidecar removes it when the JVM exits.
 *
 * <p><strong>One bucket, created here.</strong> MinIO starts empty and
 * {@code CreateBucket} is idempotent for its own owner, so contexts sharing
 * this container is safe. The name is arbitrary — production's is
 * {@code campusvibe-prod-media} — because what is asserted is the key layout
 * inside it, which is what ADR-012 separates media kinds by.
 *
 * <p><strong>Path-style addressing</strong>, because virtual-host style would
 * resolve {@code <bucket>.localhost} through DNS. {@code S3Config} sets the
 * same thing whenever an endpoint override is present; this client exists only
 * to create the bucket before Spring starts.
 */
public final class MinioTestContainer {

    /**
     * quay.io, not Docker Hub. MinIO's images are not published to Docker Hub —
     * {@code docker pull minio/minio} is refused outright, and the tag matches
     * the one {@code docker/docker-compose.yml} runs so a test and a local stack
     * are the same store.
     */
    private static final String MINIO_IMAGE = "quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z";

    private static final String ACCESS_KEY = "campusvibe-test";
    private static final String SECRET_KEY = "campusvibe-test-secret";
    private static final String BUCKET = "campusvibe-test-media";
    private static final String REGION = "ca-central-1";
    private static final int API_PORT = 9000;

    private static final GenericContainer<?> INSTANCE =
            new GenericContainer<>(DockerImageName.parse(MINIO_IMAGE))
                    .withEnv("MINIO_ROOT_USER", ACCESS_KEY)
                    .withEnv("MINIO_ROOT_PASSWORD", SECRET_KEY)
                    .withCommand("server", "/data")
                    .withExposedPorts(API_PORT)
                    // MinIO answers this without credentials once it is
                    // accepting requests; waiting on a log line would tie the
                    // suite to a release's startup banner.
                    .waitingFor(Wait.forHttp("/minio/health/live").forPort(API_PORT));

    static {
        INSTANCE.start();
        createBucket();
    }

    private MinioTestContainer() {
    }

    private static String endpoint() {
        return "http://" + INSTANCE.getHost() + ":" + INSTANCE.getMappedPort(API_PORT);
    }

    private static void createBucket() {
        try (S3Client client = S3Client.builder()
                .region(Region.of(REGION))
                .endpointOverride(URI.create(endpoint()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(ACCESS_KEY, SECRET_KEY)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build()) {
            client.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build());
        } catch (BucketAlreadyOwnedByYouException ignored) {
            // A second JVM sharing a reused container. Nothing to do.
        }
    }

    /**
     * Points Spring at the container. Called from a {@code @DynamicPropertySource}
     * so the port — which Testcontainers assigns at random — is resolved after
     * the container is up, and so these outrank {@code application-test.yml}.
     */
    public static void registerTo(DynamicPropertyRegistry registry) {
        registry.add("aws.region", () -> REGION);
        registry.add("aws.s3.bucket", () -> BUCKET);
        registry.add("aws.s3.endpoint", MinioTestContainer::endpoint);
        registry.add("aws.s3.access-key", () -> ACCESS_KEY);
        registry.add("aws.s3.secret-key", () -> SECRET_KEY);
    }
}
