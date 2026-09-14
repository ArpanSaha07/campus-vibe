package com.campusvibe.club;

import com.campusvibe.common.Logs;
import com.campusvibe.s3.MediaKeys;
import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.search.SearchLimits;
import com.campusvibe.search.SearchService;
import com.campusvibe.user.User;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.campusvibe.exception.ResourceNotFoundException;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@Validated // needed for constraints on @RequestParam, unlike @Valid on a body
@RequestMapping("/api/v1/clubs")
public class ClubController {

    private static final Logger log = LoggerFactory.getLogger(ClubController.class);

    private final ClubService clubService;
    private final SearchService searchService;
    private final S3Service s3Service;
    private final S3Buckets buckets;

    public ClubController(ClubService clubService, SearchService searchService,
                          S3Service s3Service, S3Buckets buckets) {
        this.clubService = clubService;
        this.searchService = searchService;
        this.s3Service = s3Service;
        this.buckets = buckets;
    }

    @GetMapping
    public List<ClubDTO> list() {
        return clubService.list();
    }

    @GetMapping("/search")
    public List<ClubDTO> search(
            @RequestParam @Size(max = SearchLimits.MAX_QUERY_LENGTH) String q,
                                @RequestParam(defaultValue = "20") int limit) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return searchService.searchClubs(q.trim(), Math.clamp(limit, 1, 50));
    }

    // GET /my-club is gone. It could only ever answer with one club, and it
    // gated on the platform-wide ROLE_CLUB_ADMIN, which no longer exists.
    // Its replacement is GET /api/v1/users/me/managed-clubs in
    // ClubAdminController: a list, with the caller's role in each club.

    @GetMapping("/{id}")
    public ClubDTO get(@PathVariable String id) {
        return clubService.get(id);
    }

    /**
     * A platform admin creates a club and becomes its owner.
     *
     * <p>ADMIN, not USER, since 2026-09-09. This is no longer the path an
     * ordinary user takes -- they propose through
     * {@code POST /api/v1/club-creation-requests}, which an admin approves --
     * and leaving it open would be a second, unreviewed way to create a club
     * (ADR-004).
     *
     * <p>The creating admin becomes the club's CLUB_OWNER in the same
     * transaction, so the logo, banner and social-link calls that follow this
     * one pass {@code canManageClub} by assignment rather than only by the
     * platform-admin bypass. To create a club for somebody else, invite them as
     * a CLUB_ADMIN and hand over through the ownership-transfer flow; there is
     * deliberately no ownerEmail on this payload.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ClubDTO create(@Valid @RequestBody ClubCreateRequest request,
                          Authentication authentication) {
        User creator = (User) authentication.getPrincipal();
        Club club = new Club();
        club.setId(request.id());
        club.setName(request.name());
        club.setDescription(request.description());
        // Set on this instance, before createOwnedBy, like every other field:
        // Club.id is assigned rather than generated, so saveAndFlush merges and
        // returns a different instance, and anything set afterwards would be
        // written to a detached copy (BUG-037, ADR-002). It leaves
        // official_email_verified_at at its default of NULL, which is the whole
        // of ADR-006 that applies here -- there is no stamp yet to clear.
        club.setOfficialEmail(ClubSocialLinks.normaliseOfficialEmail(request.officialEmail()));
        return clubService.createOwnedBy(club, request.category(), request.interests(),
                creator, creator);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #id)")
    public ClubDTO update(@PathVariable String id, @RequestBody ClubUpdateRequest request) {
        return clubService.update(id, request);
    }

    /**
     * A club's logo, as bytes.
     *
     * <p>The read half of {@code uploadLogo}. It exists because
     * {@code clubs.logo} holds an S3 <em>object key</em> — {@code
     * clubs/{id}/logos/{uuid}.png}, or {@code clubs/{id}/logo-{filename}} for
     * one stored before 2026-09-11 — and a key is not something a browser can
     * fetch. Until this endpoint existed, a club whose logo had been uploaded
     * rendered a broken image: the key went to the browser untouched, and
     * next/image threw {@code Failed to construct 'URL': Invalid URL} on it.
     *
     * <p>Serving the bytes through the API rather than handing out a presigned
     * or public S3 URL keeps the bucket private and works identically against
     * {@code FakeS3} locally and real S3 in production — presigning cannot work
     * against a filesystem stub, and no bucket or CDN is provisioned to be
     * public with.
     *
     * <p>Unauthenticated, like the club page it appears on. It falls under the
     * {@code GET /api/v1/clubs/**} permitAll matcher and needs no entry of its
     * own.
     */
    @GetMapping("/{id}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable String id) {
        return media(clubService.get(id).logo(), id);
    }

    /**
     * One of a club's banner images, by position in {@code ClubDTO.images}.
     *
     * <p>By index rather than by key on purpose: an endpoint that took a key
     * from the caller would read any object in the bucket it was pointed at.
     * The index is resolved against this club's own list, so the caller can
     * only ever reach that club's images.
     *
     * <p>Positions shift if an image is ever removed, which nothing can do
     * today — there is no delete endpoint. When one is added, this becomes a
     * reason to give images stable ids.
     */
    @GetMapping("/{id}/images/{index}")
    public ResponseEntity<byte[]> image(@PathVariable String id, @PathVariable int index) {
        List<String> images = clubService.get(id).images();
        if (index < 0 || index >= images.size()) {
            throw new ResourceNotFoundException(
                    "Club [%s] has no image at position %d".formatted(id, index));
        }
        return media(images.get(index), id);
    }

    private ResponseEntity<byte[]> media(String key, String clubId) {
        if (key == null || key.isBlank()) {
            throw new ResourceNotFoundException("Club [%s] has no such image".formatted(clubId));
        }
        // Seeded rows hold absolute URLs rather than keys (the demo photos come
        // from Unsplash). Those are fetched by the browser directly and never
        // reach this endpoint; answering 404 says so rather than asking S3 for
        // an object named `https://...`.
        if (key.startsWith("http://") || key.startsWith("https://")) {
            throw new ResourceNotFoundException(
                    "Club [%s] image is an external URL, not a stored object".formatted(clubId));
        }

        byte[] bytes = s3Service.getObject(buckets.getClubs(), key);
        return ResponseEntity.ok()
                .contentType(imageTypeOf(key))
                // Every upload gets a new key, but the URL is the club's --
                // /clubs/{id}/logo -- and does not change when the logo does,
                // so a long cache would pin a replaced logo. Five minutes is
                // enough to carry a page's worth of requests without that.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                // Belt and braces with the content type below: nothing here is
                // ever to be sniffed into something executable.
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
    private static MediaType imageTypeOf(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.APPLICATION_OCTET_STREAM;
    }

    /**
     * Replaces the club's logo.
     *
     * <p>The key is generated by {@link MediaKeys}, never taken from the
     * upload's filename (BUG-039), so a new logo is a new object rather than
     * an overwrite. The old one is therefore deleted here, in the order
     * {@code s3-media/reference.md} §19 asks for: store the new object, point
     * the row at it, and only then delete what it pointed at before.
     */
    @PostMapping(path = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #id)")
    public void uploadLogo(@PathVariable String id, @RequestPart("file") MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        String key = MediaKeys.clubLogo(id, bytes);
        s3Service.putObject(buckets.getClubs(), key, bytes);
        // If this throws, the object just stored is orphaned. Accepted: S3 and
        // PostgreSQL are not one transaction (§21), and an orphan is harmless.
        String previous = clubService.updateLogo(id, key);
        deleteReplacedLogo(id, previous);
    }

    /**
     * Deletes a replaced logo's object, after {@code updateLogo} has committed.
     *
     * <p>Only one of this club's own stored objects is ever deleted -- never
     * the absolute URL a seeded demo club holds, never another club's key. A
     * failure is logged, not thrown: the club already shows the new logo, and
     * failing the request would tell the user it had not.
     */
    private void deleteReplacedLogo(String clubId, String previousKey) {
        if (!MediaKeys.belongsToClub(previousKey, clubId)) {
            return;
        }
        try {
            s3Service.deleteObject(buckets.getClubs(), previousKey);
        } catch (RuntimeException e) {
            log.warn("Could not delete the replaced logo {} of club {}; the object is orphaned",
                    Logs.safe(previousKey), Logs.safe(clubId), e);
        }
    }

    @PostMapping(path = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #id)")
    public void uploadImages(@PathVariable String id, @RequestPart("files") List<MultipartFile> files) throws IOException {
        // Every file is checked before any is stored, so one refused file does
        // not leave the ones ahead of it uploaded and the request answering 400.
        List<byte[]> contents = new ArrayList<>();
        List<String> keys = new ArrayList<>();
        for (MultipartFile file : files) {
            byte[] bytes = file.getBytes();
            contents.add(bytes);
            keys.add(MediaKeys.clubImage(id, bytes));
        }
        for (int i = 0; i < keys.size(); i++) {
            s3Service.putObject(buckets.getClubs(), keys.get(i), contents.get(i));
        }
        clubService.addImages(id, keys);
    }
}
