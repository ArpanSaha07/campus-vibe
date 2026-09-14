package com.campusvibe.s3;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class FakeS3 implements S3Client {

    // TODO: Check if this works for Windows users
    private static final Path DEFAULT_ROOT =
            Path.of(System.getProperty("user.home"), ".arpan", "s3");

    private final Path root;

    public FakeS3() {
        this(DEFAULT_ROOT);
    }

    /** A stub rooted somewhere other than the home directory, for tests. */
    FakeS3(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public String serviceName() {
        return "fake";
    }

    @Override
    public void close() {

    }

    @Override
    public PutObjectResponse putObject(PutObjectRequest putObjectRequest,
                                       RequestBody requestBody)
            throws AwsServiceException, SdkClientException {
        // Resolved before the body is read, so a refused key writes nothing.
        Path target = buildObjectFullPath(putObjectRequest.bucket(), putObjectRequest.key());
        InputStream inputStream = requestBody.contentStreamProvider().newStream();

        try {
            byte[] bytes = IOUtils.toByteArray(inputStream);
            FileUtils.writeByteArrayToFile(target.toFile(), bytes);
            return PutObjectResponse.builder().build();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public ResponseInputStream<GetObjectResponse> getObject(
            GetObjectRequest getObjectRequest)
            throws  AwsServiceException, SdkClientException {

        try {
            FileInputStream fileInputStream = new FileInputStream(
                    buildObjectFullPath(
                            getObjectRequest.bucket(),
                            getObjectRequest.key()).toFile()
            );
            return new ResponseInputStream<>(
                    GetObjectResponse.builder().build(),
                    fileInputStream
            );
        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    /** Succeeds for an absent key, as S3's DeleteObject does. */
    @Override
    public DeleteObjectResponse deleteObject(DeleteObjectRequest deleteObjectRequest)
            throws AwsServiceException, SdkClientException {
        try {
            Files.deleteIfExists(buildObjectFullPath(
                    deleteObjectRequest.bucket(), deleteObjectRequest.key()));
            return DeleteObjectResponse.builder().build();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Where an object lives on disk, refusing any key that resolves outside
     * its own bucket's directory.
     *
     * <p>This is the difference between this stub and the thing it stands in
     * for. S3 keys are opaque strings, so {@code ..} in one is two characters;
     * here the key is joined onto a directory, where {@code ..} climbs. Before
     * this check, an upload named {@code ../../x} wrote a file anywhere the
     * backend could reach (BUG-039). Keys are generated server-side now
     * ({@link MediaKeys}), so a refusal here means a caller built one by hand.
     */
    private Path buildObjectFullPath(String bucketName, String key) {
        Path bucket = root.resolve(bucketName).normalize();
        Path target = bucket.resolve(key).normalize();
        if (!bucket.startsWith(root) || !target.startsWith(bucket) || target.equals(bucket)) {
            throw new IllegalArgumentException("Object key resolves outside its bucket");
        }
        return target;
    }
}
