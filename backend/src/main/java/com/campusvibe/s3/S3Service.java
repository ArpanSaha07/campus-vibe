package com.campusvibe.s3;

import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;

/**
 * Reads and writes media objects, and is the one place a key is checked before
 * it reaches the store.
 *
 * <p>The check used to live inside the filesystem stub that stood in for S3,
 * which needed it because it joined the key onto a directory (BUG-039). MinIO
 * does not need it — a key is an opaque string to a real store — which is
 * exactly why it has to be here now: a guard that lived only in the stub would
 * have been deleted along with it (ADR-011).
 */
@Service
public class S3Service {

    private final S3Client s3;

    public S3Service(S3Client s3) {
        this.s3 = s3;
    }

    public void putObject(String bucketName, String key, byte[] file) {
        MediaKeys.assertSafeKey(key);
        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();
        s3.putObject(objectRequest, RequestBody.fromBytes(file));
    }

    /**
     * @throws ResourceNotFoundException if the bucket holds no such object.
     *     A database row pointing at an object that is not there is a real
     *     state, not a server fault: an upload whose database write succeeded
     *     and whose object write did not leaves exactly this (reference.md
     *     §21, accepted). It answered 500 while the store was a filesystem
     *     stub, because a missing file surfaced as an IO failure.
     */
    public byte[] getObject(String bucketName, String key) {
        MediaKeys.assertSafeKey(key);
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        try (ResponseInputStream<GetObjectResponse> res = s3.getObject(getObjectRequest)) {
            return res.readAllBytes();
        } catch (NoSuchKeyException e) {
            throw new ResourceNotFoundException(
                    "No stored object at [%s]".formatted(key));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /** Succeeds whether or not the object exists, as S3's DeleteObject does. */
    public void deleteObject(String bucketName, String key) {
        MediaKeys.assertSafeKey(key);
        s3.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build());
    }
}
