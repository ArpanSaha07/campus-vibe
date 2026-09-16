package com.campusvibe.event;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Managing an event's photos: at most ten, remove one, choose the banner.
 *
 * <p>Arpan, 2026-09-15: a club may hold up to ten photos per event and picks
 * one as the banner, which is stored as that photo's position (first).
 */
class EventPhotoIT extends AbstractIntegrationTest {

    private record Managed(Event event, User owner) {}

    private Managed eventWithOwner() {
        Club club = createClub("photo-club", "Photo Club");
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        Event event = new Event();
        event.setTitle("Photo walk");
        event.setOrganizer(club);
        event.setDateTime(Instant.parse("2026-10-01T18:00:00Z"));
        return new Managed(eventRepository.save(event), owner);
    }

    /** A distinct, valid PNG per marker byte, so photos can be told apart when read back. */
    private static byte[] png(int marker) {
        return new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, (byte) marker};
    }

    private void upload(Managed managed, int... markers) throws Exception {
        MockMultipartHttpServletRequestBuilder request =
                multipart("/api/v1/events/" + managed.event().getId() + "/images");
        for (int marker : markers) {
            request.file(new MockMultipartFile("files", "p" + marker + ".png", "image/png", png(marker)));
        }
        mockMvc.perform(request.header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk());
    }

    /** The stored keys in position order, straight from the table. */
    private List<String> storedKeys(Long id) {
        return jdbcTemplate.queryForList(
                "SELECT url FROM event_images WHERE event_id = ? ORDER BY sort_order",
                String.class, id);
    }

    private byte[] photoAt(Long id, int index) throws Exception {
        return mockMvc.perform(get("/api/v1/events/" + id + "/images/" + index))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
    }

    @Test
    void anEventHoldsAtMostTenPhotosAndAnOverflowStoresNothing() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        upload(managed, 1, 2, 3, 4, 5, 6, 7, 8);

        mockMvc.perform(multipart("/api/v1/events/" + id + "/images")
                        .file(new MockMultipartFile("files", "a.png", "image/png", png(9)))
                        .file(new MockMultipartFile("files", "b.png", "image/png", png(10)))
                        .file(new MockMultipartFile("files", "c.png", "image/png", png(11)))
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("up to 10 photos")));

        mockMvc.perform(get("/api/v1/events/" + id)).andExpect(jsonPath("$.images", hasSize(8)));

        // Exactly ten is allowed.
        upload(managed, 9, 10);
        mockMvc.perform(get("/api/v1/events/" + id)).andExpect(jsonPath("$.images", hasSize(10)));
    }

    @Test
    void choosingABannerMovesThatPhotoToTheFront() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        upload(managed, 1, 2, 3);

        mockMvc.perform(put("/api/v1/events/" + id + "/images/2/banner")
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(3)));

        // Read back through a fresh request, not the response: the order must
        // survive being written, which is the whole of this decision.
        assertArrayEquals(png(3), photoAt(id, 0));
        assertArrayEquals(png(1), photoAt(id, 1));
        assertArrayEquals(png(2), photoAt(id, 2));
    }

    @Test
    void removingAPhotoDropsItAndTheOthersCloseUp() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        upload(managed, 1, 2, 3);
        // Read through JDBC, not the entity: Event.images is lazy and the test
        // holds no session.
        String removedKey = storedKeys(id).get(1);

        mockMvc.perform(delete("/api/v1/events/" + id + "/images/1")
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(2)));

        assertArrayEquals(png(1), photoAt(id, 0));
        assertArrayEquals(png(3), photoAt(id, 1));
        mockMvc.perform(get("/api/v1/events/" + id)).andExpect(jsonPath("$.images", hasSize(2)));
        // The row no longer names the removed key.
        org.assertj.core.api.Assertions.assertThat(storedKeys(id)).doesNotContain(removedKey);
    }

    @Test
    void aPositionTheEventDoesNotHaveIsNotFound() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        upload(managed, 1);

        mockMvc.perform(delete("/api/v1/events/" + id + "/images/5")
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/events/" + id + "/images/-1/banner")
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isNotFound());
    }

    @Test
    void someoneWhoDoesNotRunTheClubCannotRemoveOrReorder() throws Exception {
        Managed managed = eventWithOwner();
        Long id = managed.event().getId();
        upload(managed, 1, 2);
        User outsider = createUser("Outsider", "outsider@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(delete("/api/v1/events/" + id + "/images/0")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/events/" + id + "/images/1/banner")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/events/" + id)).andExpect(jsonPath("$.images", hasSize(2)));
        assertArrayEquals(png(1), photoAt(id, 0));
    }

    @Test
    void aStoredValueThatIsNotThisEventsKeyIsRemovedFromTheRowWithoutTouchingTheStore() throws Exception {
        // A seeded absolute URL: removing it must not ask S3 to delete anything,
        // and must not 500.
        Managed managed = eventWithOwner();
        Event event = managed.event();
        event.getImages().add("https://images.unsplash.com/photo-123.jpg");
        Long id = eventRepository.save(event).getId();

        mockMvc.perform(delete("/api/v1/events/" + id + "/images/0")
                        .header("Authorization", bearer(managed.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images", hasSize(0)));
    }
}
