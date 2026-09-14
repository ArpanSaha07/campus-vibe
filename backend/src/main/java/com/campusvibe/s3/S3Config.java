package com.campusvibe.s3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

/**
 * The one {@link S3Client} this application uses, in every environment.
 *
 * <p><strong>There is no mock branch, and that is the decision</strong>
 * (ADR-011). Until 2026-09-12 an {@code aws.s3.mock} flag chose between real S3
 * and a filesystem stub — and because the flag defaulted to true and only
 * {@code prod} turned it off, the real branch had <em>never executed</em>.
 * Everything S3 has and a stub does not — region resolution, the credential
 * chain, {@code NoSuchBucket}, {@code NoSuchKey} — was untested by
 * construction, which is how BUG-039 and BUG-051 both arrived.
 *
 * <p>So the client is always real. The only thing that varies is where it
 * points:
 *
 * <ul>
 *   <li>{@code aws.s3.endpoint} set — MinIO, locally and in CI. Path-style
 *       addressing, because virtual-host style would need a DNS name per
 *       bucket, and static credentials, because MinIO has no instance role.</li>
 *   <li>{@code aws.s3.endpoint} unset — AWS, resolving credentials through the
 *       default provider chain: the EC2 instance role on Elastic Beanstalk, a
 *       developer's own profile anywhere else.</li>
 * </ul>
 *
 * <p>An environment that sets neither the endpoint nor working AWS credentials
 * now fails loudly on first use rather than quietly writing media to its own
 * disk, which is what the old flag did when it failed open.
 */
@Configuration
public class S3Config {

    @Value("${aws.region}")
    private String awsRegion;

    /** Blank means AWS itself. Anything else is an S3-compatible store. */
    @Value("${aws.s3.endpoint:}")
    private String endpoint;

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        S3ClientBuilder builder = S3Client.builder().region(Region.of(awsRegion));

        if (endpoint.isBlank()) {
            return builder.build();
        }

        if (accessKey.isBlank() || secretKey.isBlank()) {
            // Fail at startup rather than on the first upload: an endpoint
            // override is always a local store, and a local store always needs
            // its credentials passed in.
            throw new IllegalStateException(
                    "aws.s3.endpoint is set to " + endpoint
                            + " but aws.s3.access-key / aws.s3.secret-key are not");
        }

        return builder
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }

}
