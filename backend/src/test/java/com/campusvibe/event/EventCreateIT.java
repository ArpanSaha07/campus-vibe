package com.campusvibe.event;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Creating an event, {@code POST /api/v1/events}, as far as its times go.
 *
 * <p>Since V35 an event must have an end, after its start and at most 14 days
 * later (Arpan, 2026-09-15). The update path is covered by
 * {@link EventUpdateIT}; this is the create path, which had no check on its
 * times at all, so a missing start used to reach the NOT NULL constraint as a
 * 500.
 */
class EventCreateIT extends AbstractIntegrationTest {

    private Map<String, Object> body(String start, String end) {
        Map<String, Object> request = new HashMap<>();
        request.put("title", "Chess night");
        request.put("dateTime", start);
        request.put("endTime", end);
        request.put("organizerId", "chess-club");
        request.put("topics", List.of());
        request.put("formats", List.of());
        return request;
    }

    private User owner() {
        Club club = createClub("chess-club", "Chess Club");
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);
        return owner;
    }

    @Test
    void anEventIsCreatedWithItsEnd() throws Exception {
        User owner = owner();

        mockMvc.perform(post("/api/v1/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                body("2026-10-01T18:00:00Z", "2026-10-01T21:00:00Z")))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dateTime").value("2026-10-01T18:00:00Z"))
                .andExpect(jsonPath("$.endTime").value("2026-10-01T21:00:00Z"));
    }

    @Test
    void aMissingInvertedOrOverlongTimeIsABadRequestAndNothingIsCreated() throws Exception {
        User owner = owner();

        List<Map<String, Object>> refused = List.of(
                body("2026-10-01T18:00:00Z", null),
                body(null, "2026-10-01T21:00:00Z"),
                body("2026-10-01T18:00:00Z", "2026-10-01T17:00:00Z"),
                body("2026-10-01T18:00:00Z", "2026-10-15T18:00:01Z"));

        for (Map<String, Object> request : refused) {
            mockMvc.perform(post("/api/v1/events")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request))
                            .header("Authorization", bearer(owner)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message", containsString("An event")));
        }

        assertThat(eventRepository.count()).isZero();
    }
}
