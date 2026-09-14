package com.campusvibe.s3;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The bucket media lives in. There is one, for every media kind (ADR-012).
 *
 * <p>This was {@code S3Buckets}, holding {@code clubs} and {@code events}
 * resolved from two environment variables whose defaults named two buckets that
 * did not exist, in an environment that set neither (BUG-051). Media kinds are
 * separated by key prefix instead — {@code clubs/…} and {@code events/…}, which
 * {@link MediaKeys} has written since 2026-09-11 — so the split was buying a
 * bucket boundary between two things with the same owner, the same lifecycle
 * and the same access rules.
 *
 * <p>The property has no default. An environment that does not name its bucket
 * fails to start, rather than failing {@code NoSuchBucket} on the first upload
 * the way production would have.
 */
@Component
public class MediaBucket {

    private final String name;

    public MediaBucket(@Value("${aws.s3.bucket}") String name) {
        // An absent property is caught by the placeholder itself, which has no
        // default; a property set to the empty string is not, and would give
        // every S3 call a bucket named "". Both are the same mistake, so both
        // fail here, at startup, rather than on the first upload.
        if (name == null || name.isBlank()) {
            throw new IllegalStateException(
                    "aws.s3.bucket is not set. Name the media bucket "
                            + "(AWS_S3_BUCKET) for this environment.");
        }
        this.name = name;
    }

    public String name() {
        return name;
    }
}
