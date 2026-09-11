package com.campusvibe.s3;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

/**
 * The filesystem stub every non-prod environment uses as its S3.
 *
 * <p>Real S3 treats a key as an opaque string, so {@code ..} in one is just two
 * characters. {@code FakeS3} joins the key onto a directory, where {@code ..}
 * climbs. That difference is what turned BUG-039 from an overwrite into a file
 * write anywhere the backend could reach, and the guard tested here is what
 * keeps the stub from being that again for any future caller.
 */
class FakeS3Test {

    private static final byte[] BYTES = {1, 2, 3};

    @TempDir
    Path tempDir;

    private Path root;
    private FakeS3 s3;

    @BeforeEach
    void setUp() {
        root = tempDir.resolve("s3");
        s3 = new FakeS3(root);
    }

    private void put(String bucket, String key) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).build(),
                RequestBody.fromBytes(BYTES));
    }

    private byte[] get(String bucket, String key) throws Exception {
        try (var in = s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build())) {
            return in.readAllBytes();
        }
    }

    @Test
    void anObjectRoundTrips() throws Exception {
        put("clubs", "clubs/robotics/logos/abc.png");

        assertThat(get("clubs", "clubs/robotics/logos/abc.png")).isEqualTo(BYTES);
        assertThat(root.resolve("clubs/clubs/robotics/logos/abc.png")).exists();
    }

    @Test
    void aKeyThatClimbsOutOfTheRootIsRefusedAndWritesNothing() {
        assertThatThrownBy(() -> put("clubs", "clubs/robotics/../../../../escape.png"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(tempDir.resolve("escape.png")).doesNotExist();
    }

    @Test
    void aKeyThatClimbsIntoAnotherBucketIsRefused() {
        assertThatThrownBy(() -> put("clubs", "../events/events/1/banners/x.png"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(root.resolve("events")).doesNotExist();
    }

    @Test
    void anAbsoluteKeyIsRefused() {
        String absolute = tempDir.resolve("absolute.png").toAbsolutePath().toString();

        assertThatThrownBy(() -> put("clubs", absolute))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(tempDir.resolve("absolute.png")).doesNotExist();
    }

    @Test
    void aKeyThatClimbsIsRefusedOnReadToo() throws Exception {
        Files.writeString(tempDir.resolve("secret.txt"), "not an image");

        assertThatThrownBy(() -> get("clubs", "../../secret.txt"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deleteRemovesTheObject() {
        put("clubs", "clubs/robotics/logos/abc.png");

        s3.deleteObject(DeleteObjectRequest.builder()
                .bucket("clubs").key("clubs/robotics/logos/abc.png").build());

        assertThat(root.resolve("clubs/clubs/robotics/logos/abc.png")).doesNotExist();
    }

    @Test
    void deletingAMissingObjectIsNotAnError() {
        // Matches S3, where DeleteObject on an absent key succeeds.
        assertThatNoException().isThrownBy(() -> s3.deleteObject(DeleteObjectRequest.builder()
                .bucket("clubs").key("clubs/robotics/logos/never-there.png").build()));
    }

    @Test
    void aDeleteThatClimbsIsRefused() throws Exception {
        Path victim = Files.writeString(tempDir.resolve("victim.txt"), "keep me");

        assertThatThrownBy(() -> s3.deleteObject(DeleteObjectRequest.builder()
                .bucket("clubs").key("../../victim.txt").build()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(victim).exists();
    }
}
