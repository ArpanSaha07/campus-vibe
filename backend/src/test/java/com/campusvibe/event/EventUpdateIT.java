package com.campusvibe.event;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Editing an event, {@code PUT /api/v1/events/{id}} (CEM-10).
 *
 * <p>There was no update path at all before 2026-09-15: a typo in a title was
 * permanent, and changing a room meant deleting the event and every RSVP on it.
 */
class EventUpdateIT extends AbstractIntegrationTest {

    private Club club;
    private Event event;

    private Event existingEvent() {
        club = createClub("robotics-club", "Robotics Club");
        Event e = new Event();
        e.setTitle("Intro to Robotics");
        e.setDescription("Bring a laptop.");
        e.setLocation("Trottier 1080");
        e.setPrice("$5");
        e.setCapacity(30);
        e.setOrganizer(club);
        e.setDateTime(Instant.parse("2026-10-01T18:00:00Z"));
        e.getTopicSlugs().add("robotics");
        e.getFormatSlugs().add("workshop");
        event = eventRepository.save(e);
        return event;
    }

    private Map<String, Object> body(String title, List<String> topics, List<String> formats) {
        Map<String, Object> request = new HashMap<>();
        request.put("title", title);
        request.put("description", "Now with pizza.");
        request.put("dateTime", "2026-10-08T19:30:00Z");
        request.put("location", null);
        request.put("price", null);
        request.put("capacity", null);
        request.put("topics", topics);
        request.put("formats", formats);
        return request;
    }

    private String json(Object body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    @Test
    void theOwnerReplacesEveryFieldAndTheTags() throws Exception {
        Event e = existingEvent();
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Robotics, week two", List.of("music"), List.of())))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Robotics, week two"));

        // Read back rather than trusting the response: the tags are element
        // collections, and a reassigned set is the classic write that is lost.
        mockMvc.perform(get("/api/v1/events/" + e.getId()))
                .andExpect(jsonPath("$.title").value("Robotics, week two"))
                .andExpect(jsonPath("$.description").value("Now with pizza."))
                .andExpect(jsonPath("$.dateTime").value("2026-10-08T19:30:00Z"))
                // Full replacement: a null clears.
                .andExpect(jsonPath("$.location").value(nullValue()))
                .andExpect(jsonPath("$.price").value(nullValue()))
                .andExpect(jsonPath("$.capacity").value(nullValue()))
                .andExpect(jsonPath("$.topics", containsInAnyOrder("music")))
                .andExpect(jsonPath("$.formats").isEmpty())
                // Still the same club -- the request has no way to move it.
                .andExpect(jsonPath("$.organizerId").value("robotics-club"));
    }

    @Test
    void aClubAdminMayEdit() throws Exception {
        Event e = existingEvent();
        User admin = createUser("Admin", "admin@campus.com", "password123", RoleName.ROLE_USER);
        makeClubAdmin(club, admin);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Edited by an admin", List.of("robotics"), List.of("workshop"))))
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void aPlatformAdminWithNoAssignmentMayEdit() throws Exception {
        Event e = existingEvent();
        User staff = createUser("Staff", "staff@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Edited by staff", List.of(), List.of())))
                        .header("Authorization", bearer(staff)))
                .andExpect(status().isOk());
    }

    @Test
    void someoneWhoDoesNotRunTheClubIsRefusedAndNothingChanges() throws Exception {
        Event e = existingEvent();
        User outsider = createUser("Outsider", "outsider@campus.com", "password123", RoleName.ROLE_USER);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Hijacked", List.of(), List.of())))
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isForbidden());

        int anonymous = mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Hijacked", List.of(), List.of()))))
                .andReturn().getResponse().getStatus();
        assertThat(anonymous).isIn(401, 403);

        mockMvc.perform(get("/api/v1/events/" + e.getId()))
                .andExpect(jsonPath("$.title").value("Intro to Robotics"));
    }

    @Test
    void anUnknownTagIsABadRequestNamingIt() throws Exception {
        Event e = existingEvent();
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Fine title", List.of("not-a-topic"), List.of())))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("not-a-topic")));
    }

    @Test
    void aBlankTitleOrMissingDateIsABadRequestNotA500() throws Exception {
        Event e = existingEvent();
        User owner = createUser("Owner", "owner@campus.com", "password123", RoleName.ROLE_USER);
        makeClubOwner(club, owner);

        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("   ", List.of(), List.of())))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest());

        Map<String, Object> noDate = body("Fine title", List.of(), List.of());
        noDate.put("dateTime", null);
        mockMvc.perform(put("/api/v1/events/" + e.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(noDate))
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anEventThatDoesNotExistIsNotFoundForStaff() throws Exception {
        User staff = createUser("Staff", "staff@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);

        mockMvc.perform(put("/api/v1/events/999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body("Anything", List.of(), List.of())))
                        .header("Authorization", bearer(staff)))
                .andExpect(status().isNotFound());
    }
}
