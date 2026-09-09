package com.campusvibe.club;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import static org.hamcrest.Matchers.is;
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
                .andExpect(jsonPath("$.logo", is("clubs/robotics/logo-badge.png")));

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

    @Test
    void anUploadedSvgIsNeverServedAsSvg() throws Exception {
        User admin = admin();
        createClubAs(admin, "robotics");

        // Nothing validates what is uploaded (BUG-039). An SVG is a document
        // that can carry script, so it is served as a download rather than
        // rendered on the API's origin.
        mockMvc.perform(multipart("/api/v1/clubs/robotics/logo")
                        .file(new MockMultipartFile("file", "evil.svg", "image/svg+xml",
                                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>".getBytes()))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/clubs/robotics/logo"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM));
    }
}
