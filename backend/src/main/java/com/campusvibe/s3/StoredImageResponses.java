package com.campusvibe.s3;

import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * Serves a stored image's bytes, for every entity that has them.
 *
 * <p>This was {@code ClubController.media} until 2026-09-12, when events got a
 * read path of their own (BUG-042). It moved here rather than being copied so
 * that the two guards below -- nothing that is not an object key is fetched,
 * and nothing that is not a raster image is rendered -- exist once. A copy
 * would drift, and the half that drifted would be the one serving an SVG.
 *
 * <p>Callers resolve which key to serve from their own row, by index, and never
 * accept one from the request (ADR-007). This class only turns a key the caller
 * already trusts into a response.
 */
@Component
public class StoredImageResponses {

    private final S3Service s3Service;
    private final MediaBucket mediaBucket;

    public StoredImageResponses(S3Service s3Service, MediaBucket mediaBucket) {
        this.s3Service = s3Service;
        this.mediaBucket = mediaBucket;
    }

    /**
     * @param key   the stored value, as the row holds it
     * @param owner how to name the row in a 404, for example {@code Club [robotics]}
     * @throws ResourceNotFoundException when there is no key, when the value is
     *     not an object key at all, or when the bucket holds no such object
     */
    public ResponseEntity<byte[]> serve(String key, String owner) {
        if (key == null || key.isBlank()) {
            throw new ResourceNotFoundException("%s has no such image".formatted(owner));
        }
        // Seeded rows hold absolute URLs (the demo photos come from Unsplash),
        // and a fixture may hold a root-relative path into the frontend's
        // public folder. The browser fetches both directly and they never reach
        // this endpoint; answering 404 says so rather than asking S3 for an
        // object named `https://...`, which assertSafeKey would refuse anyway.
        if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("/")) {
            throw new ResourceNotFoundException(
                    "%s image is not a stored object".formatted(owner));
        }

        byte[] bytes = s3Service.getObject(mediaBucket.name(), key);
        return ResponseEntity.ok()
                .contentType(imageTypeOf(key))
                // Every upload gets a new key, but the URL is the owner's --
                // /clubs/{id}/logo, /events/{id}/images/0 -- and does not
                // change when the image does, so a long cache would pin a
                // replaced one. Five minutes carries a page's worth of requests.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                // Belt and braces with the content type: nothing here is ever to
                // be sniffed into something executable.
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }

    /**
     * The content type to serve a stored object as, from its extension.
     *
     * <p>Only raster image types are named. Everything else — an SVG included —
     * is served as {@code application/octet-stream}, so the browser saves it
     * rather than rendering it. Uploads have refused anything but PNG, JPEG and
     * WebP since 2026-09-11 ({@link MediaKeys}), but objects stored before then
     * were never checked (BUG-039): an SVG is a document that can carry
     * script, and serving one as {@code image/svg+xml} would execute it on the
     * API's origin. This stays as the second line of defence -- do not add svg
     * to this map.
     */
    static MediaType imageTypeOf(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
