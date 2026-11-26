package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.Club;
import com.campusvibe.event.Event;
import com.campusvibe.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The planner's evaluation set: prompts a student would type, and the events a
 * person would expect to be offered for each, against a seeded calendar
 * mirroring 2026-11-26, the day <em>suggest tech events happening today</em>
 * offered a bake sale and missed the GDG workshop
 * (spec 2026-11-26-planner-topic-and-date-retrieval).
 *
 * <p>It asserts what retrieval offers the model, not what the model picks.
 * No embedding key is set here, so search runs on keywords alone: the
 * topic and day filtering under test does not depend on embeddings.
 *
 * <p>"Today" is a Thursday at least a week ahead, at 14:30 in Montreal, so the
 * calendar never depends on the hour the suite runs.
 */
class PlannerRetrievalEvalIT extends PlannerIntegrationTest {

    @Autowired private PlannerRetrievalService retrievalService;

    private final LocalDate thursday = LocalDate.now(PlannerDay.ZONE).plusWeeks(1)
            .with(TemporalAdjusters.nextOrSame(DayOfWeek.THURSDAY));
    private final Instant now = at(0, "14:30");

    private final Map<String, Long> ids = new HashMap<>();
    private User student;

    private Instant at(int dayOffset, String time) {
        return thursday.plusDays(dayOffset).atTime(LocalTime.parse(time)).atZone(PlannerDay.ZONE).toInstant();
    }

    private void event(String key, Club club, int day, String start, String end, String description,
                       String... topics) {
        Event event = new Event();
        event.setTitle(key);
        event.setDescription(description);
        event.setOrganizer(club);
        event.setDateTime(at(day, start));
        event.setEndTime(at(day, end));
        event.getTopicSlugs().addAll(List.of(topics));
        ids.put(key, eventRepository.save(event).getId());
    }

    @BeforeEach
    void calendar() {
        student = student("student@campus.com");
        Club mchacks = createClub("mchacks", "McHacks");
        Club claude = createClub("claude-builder-club", "Claude Builder Club @ McGill");
        Club csus = createClub("csus", "McGill CSUS");
        Club wit = createClub("women-in-tech", "Women in Tech");
        Club caribbean = createClub("caribbean", "The McGill Caribbean Students Society");
        Club bsn = createClub("bsn", "Black Students' Network");
        Club arab = createClub("arab-students", "McGill Arab Students' Network");
        Club cdsi = createClub("cdsi", "McGill Computational & Data Systems Institute");

        // Thursday: four tech events, and five that are not.
        event("Building AI Voice Agents", mchacks, 0, "18:00", "20:00",
                "A hands-on workshop on building AI voice agents, co-hosted by GDG McGill and DevPro.",
                "software-development", "ai-machine-learning");
        event("Make Your Own Website", csus, 0, "18:00", "20:00",
                "Learn HTML and CSS from scratch.", "web-development");
        event("Introduction to AI Agents", claude, 0, "18:30", "20:00",
                "What an agent is, and how to build one.", "ai-machine-learning");
        event("Build Your AI Agent", claude, 0, "18:30", "20:30",
                "Bring a laptop.", "tech", "ai-machine-learning");
        event("Bake Sale", caribbean, 0, "12:00", "16:00",
                "Come grab treats at our event today, happening all afternoon!", "baking", "food-drink");
        event("Soul Food", bsn, 0, "12:30", "15:00",
                "Our yearly food event is happening today.", "food-drink");
        event("Game Night", wit, 0, "18:00", "21:00",
                "Women in Tech hosts a relaxed evening of board games.", "board-games");
        event("Slime Making Workshop", wit, 0, "16:00", "18:00",
                "Make slime with Women in Tech.", "social");
        event("Arab Fest", arab, 0, "17:00", "21:00",
                "Music, dance and food from across the Arab world.", "arts-culture", "food-drink");

        // Friday, and the Tuesday after; nothing on the weekend.
        event("Inclusive AI", cdsi, 1, "13:00", "15:00",
                "A panel on equity in machine learning.", "data-science", "ai-machine-learning");
        event("Snack-Stealing Competition", bsn, 1, "13:00", "15:00",
                "Fastest hands win.", "social");
        event("Hackathon Kickoff", mchacks, 5, "18:00", "21:00",
                "Teams, themes and pizza.", "hackathons", "software-development");
    }

    private Set<String> offered(String prompt) {
        return offered(prompt, null);
    }

    private Set<String> offered(String prompt, String previousPrompt) {
        Map<Long, String> titles = ids.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getValue, Map.Entry::getKey));
        return retrievalService.retrieve(student.getId(), prompt, previousPrompt, List.of(), now)
                .events().stream()
                .map(event -> titles.get(event.id()))
                .collect(Collectors.toSet());
    }

    @Test
    void techEventsTodayAreTodaysTechEventsAndNothingElse() {
        assertThat(offered("suggest tech events happening today")).containsExactlyInAnyOrder(
                "Building AI Voice Agents", "Make Your Own Website", "Introduction to AI Agents",
                "Build Your AI Agent");
    }

    @Test
    void aiWorkshopsTomorrow() {
        assertThat(offered("any AI workshops tomorrow?")).containsExactly("Inclusive AI");
    }

    @Test
    void tonightIsWhatOverlapsTheEvening() {
        assertThat(offered("what's on tonight?")).containsExactlyInAnyOrder(
                "Building AI Voice Agents", "Make Your Own Website", "Introduction to AI Agents",
                "Build Your AI Agent", "Game Night", "Slime Making Workshop", "Arab Fest");
    }

    @Test
    void foodToday() {
        assertThat(offered("free food today")).containsExactlyInAnyOrder("Bake Sale", "Soul Food", "Arab Fest");
    }

    @Test
    void boardGamesTodayIsNotEveryWomenInTechEvent() {
        assertThat(offered("board games today")).containsExactly("Game Night");
    }

    @Test
    void aFollowUpKeepsTheTopicAndChangesTheDay() {
        assertThat(offered("what about tomorrow?", "suggest tech events happening today"))
                .containsExactly("Inclusive AI");
    }

    @Test
    void hackathonsNextWeek() {
        assertThat(offered("hackathons next week")).containsExactly("Hackathon Kickoff");
    }

    @Test
    void aWeekendWithNothingOnOffersNothing() {
        assertThat(offered("anything this weekend?")).isEmpty();
        assertThat(offered("tech events this weekend")).isEmpty();
    }

    @Test
    void aTopicNothingHasFallsBackToTheDay() {
        assertThat(offered("any robotics events tomorrow?"))
                .containsExactlyInAnyOrder("Inclusive AI", "Snack-Stealing Competition");
    }

    @Test
    void techWithNoDayIsEveryTechEventComing() {
        assertThat(offered("tech events")).containsExactlyInAnyOrder(
                "Building AI Voice Agents", "Make Your Own Website", "Introduction to AI Agents",
                "Build Your AI Agent", "Inclusive AI", "Hackathon Kickoff");
    }

    @Test
    void aPromptNamingNothingStillOffersWhatIsOn() {
        assertThat(offered("anything fun to do?")).hasSize(ids.size());
    }
}
