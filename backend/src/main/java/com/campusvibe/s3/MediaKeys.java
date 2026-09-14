package com.campusvibe.s3;

import com.campusvibe.exception.RequestValidationException;

import java.util.UUID;

/**
 * The only place a media object key is built.
 *
 * <p>Keys used to be {@code prefix + file.getOriginalFilename()}, at all three
 * upload sites. The filename is whatever the caller put in the multipart
 * header, so the caller chose the object: a repeated name silently replaced the
 * first upload, and against the filesystem stub that stood in for S3 in every
 * environment but {@code prod}, a name of {@code ../../x} was a file write
 * anywhere the backend could reach (BUG-039). That stub is gone (ADR-011), and
 * {@link #assertSafeKey} is what replaces the guard it carried.
 *
 * <p>So nothing here takes a filename. The prefix is built from an id the
 * permission check has already resolved, the name is a fresh uuid, and the
 * extension is read from the file's own leading bytes. The layout is the one in
 * {@code s3-media/reference.md} §7, and it is what lets a single bucket hold
 * every media kind (ADR-012) -- the prefixes were already the separation.
 *
 * <p>Only PNG, JPEG and WebP are accepted (§12). The declared part
 * {@code Content-Type} is ignored along with the filename: both are written by
 * the caller. Anything else -- an SVG in particular, which is a document that
 * can carry script -- is refused before a byte is stored.
 */
public final class MediaKeys {

    private MediaKeys() {}

    public static String clubLogo(String clubId, byte[] bytes) {
        return key("clubs/" + segment(clubId) + "/logos", bytes);
    }

    public static String clubImage(String clubId, byte[] bytes) {
        return key("clubs/" + segment(clubId) + "/images", bytes);
    }

    public static String eventBanner(Long eventId, byte[] bytes) {
        return key("events/" + eventId + "/banners", bytes);
    }

    /**
     * Whether a stored key is one of this club's own objects, and so safe to
     * delete on its behalf.
     *
     * <p>False for null, for the absolute URLs the seeded demo clubs hold, and
     * for anything that only looks like it is under the prefix until its dot
     * segments are resolved. True for a key written before 2026-09-11 in the
     * old {@code logo-{filename}} shape, which is still this club's object.
     */
    public static boolean belongsToClub(String key, String clubId) {
        // A backslash is a literal on S3, but it has been a separator to
        // everything that has ever stood in for S3 on a Windows machine.
        if (key == null || key.isBlank() || key.contains("://") || key.contains("\\")) {
            return false;
        }
        if (!key.startsWith("clubs/" + clubId + "/")) {
            return false;
        }
        // Checked by segment rather than through Path, which throws on a
        // Windows machine for characters an old filename-derived key can hold.
        for (String segment : key.split("/")) {
            if (segment.equals("..") || segment.equals(".")) {
                return false;
            }
        }
        return true;
    }

    /**
     * Refuses a key that is not a plain, relative, dot-free path.
     *
     * <p>The filesystem stub that stood in for S3 until 2026-09-12 carried this
     * check, because it joined the key onto a directory where {@code ..} climbs
     * — a vulnerability the stub had and S3 does not, which was BUG-039. MinIO
     * replaced it (ADR-011), and a real store treats a key as an opaque string,
     * so nothing downstream checks this any more. The guard moved here rather
     * than being deleted with the stub: it is the second line of defence behind
     * server-generated keys, and one that existed only inside the thing being
     * deleted was not a second line of defence at all.
     *
     * <p>Applied by {@link S3Service} to every put, get and delete, so it covers
     * keys read back from a database row as well as keys built above.
     */
    static void assertSafeKey(String key) {
        if (key == null || key.isBlank()
                || key.startsWith("/") || key.contains("//")
                || key.contains("\\") || key.contains("://")) {
            throw new IllegalArgumentException("Not a usable media object key");
        }
        for (String segment : key.split("/")) {
            if (segment.equals(".") || segment.equals("..")) {
                throw new IllegalArgumentException("Not a usable media object key");
            }
        }
    }

    private static String key(String prefix, byte[] bytes) {
        return prefix + "/" + UUID.randomUUID() + "." + extensionOf(bytes);
    }

    /**
     * A club id as one path segment.
     *
     * <p>Club ids are slugs the client chooses, and nothing validates their
     * shape. A slash or a dot segment cannot reach this through a URL today --
     * the firewall refuses encoded slashes and {@code ..} -- but the key must
     * not depend on the firewall to stay under its prefix.
     */
    private static String segment(String clubId) {
        if (clubId == null || clubId.isBlank() || clubId.equals(".") || clubId.equals("..")
                || clubId.contains("/") || clubId.contains("\\")) {
            throw new IllegalArgumentException("Not a usable club id for a media key");
        }
        return clubId;
    }

    private static String extensionOf(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new RequestValidationException("The uploaded file is empty");
        }
        if (startsWith(bytes, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return "png";
        }
        if (startsWith(bytes, 0, 0xFF, 0xD8, 0xFF)) {
            return "jpg";
        }
        // RIFF, a four-byte length, then the form type. WAV and AVI are RIFF too.
        if (startsWith(bytes, 0, 'R', 'I', 'F', 'F') && startsWith(bytes, 8, 'W', 'E', 'B', 'P')) {
            return "webp";
        }
        throw new RequestValidationException("Images must be PNG, JPEG or WebP");
    }

    private static boolean startsWith(byte[] bytes, int offset, int... signature) {
        if (bytes.length < offset + signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((bytes[offset + i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
