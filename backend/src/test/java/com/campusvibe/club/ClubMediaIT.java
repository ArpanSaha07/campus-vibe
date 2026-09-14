package com.campusvibe.club;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Uploading a club's images and reading them back.
 *
 * <p>The read half existed nowhere until 2026-09-09. {@code clubs.logo} holds an
 * S3 object <em>key</em>, which no browser can fetch: handed straight to
 * next/image it threw {@code Failed to construct 'URL': Invalid URL} and took
 * the whole {@code /clubs} page down. It stayed latent for as long as nothing
 * could upload a logo, and became reachable the moment the create form could.
 */
class ClubMediaIT extends AbstractIntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    /** A second, different PNG, to tell two uploads apart when reading back. */
    private static final byte[] OTHER_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 42};

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    @Autowired private S3Service s3Service;
    @Autowired private S3Buckets buckets;

    private User admin() {
        return createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
    }

    private void createClubAs(User user, String id) throws Exception {
        mockMvc.perform(post("/api/v1/clubs")
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                java.util.Map.of("id", id, "name", "Robotics"))))
                .andExpect(status().isOk());
    }

    @Test
    void anUploadedLogoIsServedBackAsAnImage() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");

        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", "badge.png", "image/png", PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        // What the DTO carries is still the key -- the frontend adapter turns it
        // into this endpoint's URL. Asserted so that a change to either side is
        // not silently made alone.
        mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andExpect(jsonPath("$.logo",
                        matchesPattern("clubs/robotics/logos/" + UUID_PATTERN + "\\.png")));

        byte[] served = mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(PNG, served);
    }

    @Test
    void theLogoIsPublic() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");
        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", "badge.png", "image/png", PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        // No token: it appears on the unauthenticated /clubs page, so it has to
        // be readable by an anonymous caller like the club itself is.
        mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isOk());
    }

    @Test
    void aClubWithNoLogoIsNotFoundRatherThanEmpty() throws Exception {
        createClubAs(admin(), "robotics");

        mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isNotFound());
    }

    @Test
    void bannerImagesAreAddressedByIndex() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");

        mockMvc.perform(multipart("/api/v1/clubs/robotics/images")
                        .file(new MockMultipartFile("files", "one.png", "image/png", PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/clubs/robotics/images/0"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));

        // Out of range is a 404, not an index error. The index is resolved
        // against this club's own list precisely so a caller cannot name an
        // arbitrary object key and have the server fetch it.
        mockMvc.perform(get("/api/v1/clubs/robotics/images/7"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/clubs/robotics/images/-1"))
                .andExpect(status().isNotFound());
    }

    @Test
    void anExternalUrlIsNotTreatedAsAStoredObject() throws Exception {
        // The demo clubs hold absolute Unsplash urls rather than keys. Those are
        // fetched by the browser directly; asking this endpoint for one must not
        // send S3 looking for an object called "https://...".
        Club club = createClub("robotics", "Robotics");
        club.setLogo("https://images.unsplash.com/photo-123.jpg");
        clubRepository.save(club);

        mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isNotFound());
    }

    /**
     * The read-side half of ADR-007, kept although uploads now refuse SVG.
     *
     * <p>An SVG can no longer be uploaded (below), but objects stored before
     * 2026-09-11 were never checked, so one may already be in the bucket. An
     * SVG is a document that can carry script; it is served as a download
     * rather than rendered on the API's origin. Written onto the row directly,
     * the way an external URL is seeded above, because no upload can make one.
     */
    @Test
    void aStoredSvgIsNeverServedAsSvg() throws Exception {
        Club club = createClub("robotics", "Robotics");
        String key = "clubs/robotics/logo-evil.svg";
        s3Service.putObject(buckets.getClubs(), key,
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>".getBytes(StandardCharsets.UTF_8));
        club.setLogo(key);
        clubRepository.save(club);

        mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM));
    }

    // --- BUG-039: the caller no longer names the object -----------------------

    /**
     * The traversal the PR #44 security review found.
     *
     * <p>The filename is the one a raw multipart request can set to anything.
     * Before 2026-09-11 it was concatenated into the key, and {@code FakeS3}
     * joined the key onto a directory, so this wrote a file wherever it
     * pointed. Now the filename is never read: the key is generated, and the
     * probe path is never created.
     *
     * <p>MockMvc does not run Tomcat's multipart parser, so this proves the
     * controller ignores the name, not what Spring would have passed through.
     * The fix makes that question moot.
     */
    @Test
    void aFilenameCannotChooseWhereTheLogoIsWritten() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");
        String probe = "campusvibe-bug039-" + UUID.randomUUID() + ".png";
        String hostile = "../".repeat(16) + "tmp/" + probe;

        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", hostile, "image/png", PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andExpect(jsonPath("$.logo",
                        matchesPattern("clubs/robotics/logos/" + UUID_PATTERN + "\\.png")));
        assertThat(Path.of("/tmp", probe)).doesNotExist();
    }

    @Test
    void aFilenameCannotChooseWhereABannerIsWritten() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");
        String probe = "campusvibe-bug039-" + UUID.randomUUID() + ".png";

        mockMvc.perform(multipart("/api/v1/clubs/robotics/images")
                        .file(new MockMultipartFile("files", "../".repeat(16) + "tmp/" + probe,
                                "image/png", PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andExpect(jsonPath("$.images[0]",
                        matchesPattern("clubs/robotics/images/" + UUID_PATTERN + "\\.png")));
        assertThat(Path.of("/tmp", probe)).doesNotExist();
    }

    @Test
    void theSameFilenameTwiceIsTwoObjects() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");

        // Both named one.png. The second used to replace the first object
        // while addImages appended a second entry pointing at it, so both
        // positions served the second file.
        mockMvc.perform(multipart("/api/v1/clubs/robotics/images")
                        .file(new MockMultipartFile("files", "one.png", "image/png", PNG))
                        .file(new MockMultipartFile("files", "one.png", "image/png", OTHER_PNG))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        byte[] first = mockMvc.perform(get("/api/v1/clubs/robotics/images/0"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        byte[] second = mockMvc.perform(get("/api/v1/clubs/robotics/images/1"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(PNG, first);
        assertArrayEquals(OTHER_PNG, second);
    }

    @Test
    void replacingTheLogoDeletesTheOldObject() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");
        String oldKey = uploadLogo(admin, PNG);

        String newKey = uploadLogo(admin, OTHER_PNG);

        assertThat(newKey).isNotEqualTo(oldKey);
        assertThatThrownBy(() -> s3Service.getObject(buckets.getClubs(), oldKey))
                .isInstanceOf(RuntimeException.class);
        byte[] served = mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(OTHER_PNG, served);
    }

    @Test
    void replacingALogoStoredUnderTheOldKeyShapeDeletesItToo() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");
        // What uploadLogo wrote before 2026-09-11.
        String legacyKey = "clubs/robotics/logo-badge.png";
        s3Service.putObject(buckets.getClubs(), legacyKey, PNG);
        Club club = clubRepository.findById("robotics").orElseThrow();
        club.setLogo(legacyKey);
        clubRepository.save(club);

        uploadLogo(admin, OTHER_PNG);

        assertThatThrownBy(() -> s3Service.getObject(buckets.getClubs(), legacyKey))
                .isInstanceOf(RuntimeException.class);
    }

    private static final String WRONG_TYPE = "PNG, JPEG or WebP";

    @Test
    void anSvgIsRefusedAndNothingIsStored() throws Exception {
        assertRefused("evil.svg", "image/svg+xml",
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>".getBytes(StandardCharsets.UTF_8),
                WRONG_TYPE);
    }

    @Test
    void aGifIsRefused() throws Exception {
        assertRefused("party.gif", "image/gif",
                "GIF89a ".getBytes(StandardCharsets.ISO_8859_1), WRONG_TYPE);
    }

    @Test
    void textRenamedToPngIsRefused() throws Exception {
        // The name and the declared type both say PNG. Neither is read.
        assertRefused("badge.png", "image/png",
                "<html><script>1</script></html>".getBytes(StandardCharsets.UTF_8), WRONG_TYPE);
    }

    @Test
    void anEmptyFileIsRefused() throws Exception {
        assertRefused("badge.png", "image/png", new byte[0], "empty");
    }

    private void assertRefused(String filename, String contentType, byte[] bytes,
                               String expectedMessage) throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");

        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", filename, contentType, bytes))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString(expectedMessage)));

        mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andExpect(jsonPath("$.logo", nullValue()));
    }

    /** Uploads a logo as the given user and returns the key the club now holds. */
    private String uploadLogo(User user, byte[] bytes) throws Exception {
        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", "badge.png", "image/png", bytes))
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk());
        String body = mockMvc.perform(get("/api/v1/clubs/robotics"))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.logo");
    }
}
