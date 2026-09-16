package com.campusvibe.event;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Uploading an event's photos and reading them back.
 *
 * <p>{@code POST /events/{id}/images} had no test at all until 2026-09-11, and
 * built its key from the browser's filename exactly as the club uploads did
 * (BUG-039). The read half, {@code GET /events/{id}/images/{index}}, arrived on
 * 2026-09-12 (BUG-042): until then an uploaded photo was stored and never
 * served, and the key crashed the page that tried to show it.
 */
class EventMediaIT extends AbstractIntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    /** A second, different PNG, to tell two uploads apart when reading back. */
    private static final byte[] OTHER_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 42};

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    /** An event, and a user who manages it by owning its organizing club. */
    private record Managed(Event event, User owner) {}

    private Managed eventWithOwner() {
        Club club = createClub("chess-club", "Chess Club");
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        Event event = new Event();
        event.setTitle("Chess night");
        event.setOrganizer(club);
        event.setDateTime(Instant.parse("2026-10-01T18:00:00Z"));
        event.setEndTime(Instant.parse("2026-10-01T20:00:00Z"));
        return new Managed(eventRepository.save(event), owner);
    }

    @Test
    void aFilenameCannotChooseWhereAPhotoIsWritten() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        String probe = "campusvibe-bug039-" + UUID.randomUUID() + ".png";

        mockMvc.perform(multipart("/api/v1/events/" + id + "/images")
                        .file(new MockMultipartFile("files", "../".repeat(16) + "tmp/" + probe,
                                "image/png", PNG))
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/events/" + id))
                .andExpect(jsonPath("$.images", hasSize(1)))
                .andExpect(jsonPath("$.images[0]",
                        matchesPattern("events/" + id + "/images/" + UUID_PATTERN + "\\.png")));
        assertThat(Path.of("/tmp", probe)).doesNotExist();
    }

    @Test
    void anSvgPhotoIsRefusedAndNothingIsStored() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();

        mockMvc.perform(multipart("/api/v1/events/" + id + "/images")
                        .file(new MockMultipartFile("files", "evil.svg", "image/svg+xml",
                                "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"
                                        .getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("PNG, JPEG or WebP")));

        mockMvc.perform(get("/api/v1/events/" + id))
                .andExpect(jsonPath("$.images", empty()));
    }

    @Test
    void oneRefusedFileRefusesTheWholeBatch() throws Exception {
        // Checked before anything is stored, so a good file ahead of a bad one
        // is not left half-uploaded.
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();

        mockMvc.perform(multipart("/api/v1/events/" + id + "/images")
                        .file(new MockMultipartFile("files", "good.png", "image/png", PNG))
                        .file(new MockMultipartFile("files", "bad.gif", "image/gif",
                                "GIF89a".getBytes(StandardCharsets.ISO_8859_1)))
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/events/" + id))
                .andExpect(jsonPath("$.images", empty()));
    }

    // --- The read path, BUG-042 --------------------------------------------------

    @Test
    void uploadedPhotosAreServedBackByIndexWithoutAToken() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();

        mockMvc.perform(multipart("/api/v1/events/" + id + "/images")
                        .file(new MockMultipartFile("files", "one.png", "image/png", PNG))
                        .file(new MockMultipartFile("files", "two.png", "image/png", OTHER_PNG))
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk());

        // No token: the event page is public, so its photos have to be too.
        byte[] first = mockMvc.perform(get("/api/v1/events/" + id + "/images/0"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getContentAsByteArray();
        byte[] second = mockMvc.perform(get("/api/v1/events/" + id + "/images/1"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(PNG, first);
        assertArrayEquals(OTHER_PNG, second);
    }

    @Test
    void aPositionTheEventDoesNotHaveIsNotFound() throws Exception {
        // Resolved against this event's own list, so an out-of-range index is a
        // 404 and there is no way to name another object.
        Long id = eventWithOwner().event().getId();

        mockMvc.perform(get("/api/v1/events/" + id + "/images/0"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/events/" + id + "/images/-1"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/events/999999/images/0"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aStoredValueThatIsNotAnObjectKeyIsNotFetched() throws Exception {
        // An absolute URL or a path into the frontend's public folder is fetched
        // by the browser directly. Asking the store for one must be a 404, not
        // a request for an object called https://... and not a 500.
        Managed managed = eventWithOwner();
        Event event = managed.event();
        event.getImages().add("https://images.unsplash.com/photo-123.jpg");
        event.getImages().add("/banners/fta.jpg");
        Long id = eventRepository.save(event).getId();

        mockMvc.perform(get("/api/v1/events/" + id + "/images/0"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/events/" + id + "/images/1"))
                .andExpect(status().isNotFound());
    }
}
